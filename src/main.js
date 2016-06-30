/** @namespace Uvis */
import streamReader from './compiler/streamReader';
import tokenizer from './compiler/tokenizer';
import vismParser from './vismParser';
import visParser from './visParser';
import map from './map';
import canvas from './canvas';
import form from './form';
import system from './system';
import helpers from './helpers';
import configValidator from './configValidator';
import visMapValidator from './visMapValidator';
import browserValidator from './browserValidator';
import toolBox from './toolBox';
import events from './events';
//const events = {};


/**
 * Start the GUI generation process
 * @memberof Uvis
 */
function run () {
  map.setSystem(system);
  canvas.setSystem(system);
  const startEventHandler = events['renderingStart'];
  if(typeof startEventHandler === 'function')
    startEventHandler();

  // (1) OPEN VISM FILE
  reset(); // usefull if a screen was already generated
  system.openVismfile().then(function(stream) {
    // I return a new promise because the vism file might contain a database 
    // schema description. In this case, an async call is made to the database.
    // But the vismfile might NOT describe a database. In this case there is
    // no async call. I am not sure that returning a Promise in this case
    // is the most elegant solution.
    return new Promise(function (resolve, reject) {
      //map.setResourceProvider(resourceProvider);
      vismParser.init({
        tokenizer: tokenizer(streamReader(stream)),
        system: system,
        map:map
      });
      vismParser.parse();

  // (2) EVENTUALLY BUILD DB SCHEMA

      // I believe it would be best here to return the promise of building a
      // a schema. But this is problematic if there is no database schema since
      // what to return then? null? the visfileName?
      if(map.hasSchemaDefinition()) {
        map.buildSchema().then(function() {
          resolve(system.openVisfile());
        });
      } else {
        resolve(system.openVisfile());
      }
    });
  // (3) VIS FILE OPENED
  }).then(function(stream) {

    visParser.init({
      tokenizer: tokenizer(streamReader(stream)), 
      canvas: canvas, 
      form: form
    });

    visParser.parse();

  // (4) CREATE TEMPLATE TREE
    createTree();
    return allocate();

  // (5) DATA INSTANCES READY
  }).then(function (data) {

    const tree = form.getTree();
    canvas.createHTMLCanvas(screen);
    render(form.getTree(), data);
    canvas.reflow();
    //system.getPlaceholder().appendChild(screen);
    const endEventHandler = events['renderingSucceeded'];
    if(typeof endEventHandler === 'function')
      endEventHandler();

  // (6) EVENTUALLY, SOMETHING WENT WRONG IN THE PROCESS
  }).catch(function (err) {
    canvas.throwError(err);
    throw(err);
  });
}

function createTree() {
  const templateList = form.getTemplateList();
  for(let name in templateList) {
    const template = templateList[name];
    if(template.rows) {
      const env = {form: form, map: map, template: template, property: 'Rows'};
      if(!template.updated)
        preEvaluate(template.rows, env);
    } else {
      form.getTree().appendChild(template);
    }
  }

  // preEvaluate all other properties
  for(let idx in templateList) {
    const template = templateList[idx];
    for(let property in template.properties) {
      const env = {form: form, map: map, template: template, property: property};
      preEvaluate(template.properties[property], env);
    }
  }
}

/**
 * Allocation sends all existing query models on the templates to resource provider
 * @memberof Uvis
 * @return {Promise} object representing the queue of data instances
 */
function allocate() {
  return new Promise( function (resolve, reject) {
    const templateList = form.getTemplateList();
    const dataQueue = [];
    for(let i in templateList) {
      if(templateList[i].query) {
        const resourceProvider = system.getResourceProvider();
        const dbProvider = map.getSelectedDbProvider();
        dataQueue.push(resourceProvider('query', {
          template:templateList[i], 
          translator: dbProvider.translator,
          source: map.getDbInfo().Source}));
      }
    }
    resolve(Promise.all(dataQueue));
  });
}

/**
 * Recursively goes through the template tree and render it
 * @memberof Uvis
 * @param {template} a tree of templates
 */
function render(template) {
  if(template.rows) {
    const env = {form: form, map: map, template: template, property: 'Rows'};
    const instances = evaluate(template.rows, env);
    env.instances = instances;
    if(instances) {
      for(let i=0, len=instances.length; i<len; i++) {
        const component = canvas.createComponent(template.componentType);
        template.index=i;
        template.instance = instances[i];
        for(let propertyName in template.properties) {
          const property = template.properties[propertyName];
          env.property = propertyName;
          const evaluatedProperty = evaluate(property, env);
          // caches the evaluated value on the property so that it can be
          // returned immediatelly if requested by another template
          // this saves the cost of an unecessary evaluation if a property
          // was already evaluated once
          property.cache = evaluatedProperty;
          component.setProperty(propertyName, evaluatedProperty);
        }
        template.bundle.push(component);
        canvas.getTree().appendChild(component);
        if(template.children) {
          for(let i=0, len=template.children.length; i<len; i++) {
            render(template.children[i]);
          }
        }
      }
    }
  } else {
    const component = (template.componentType === 'Canvas') ? canvas.getTree() : canvas.createComponent(template.componentType);
    const env = {form:form, template: template};
    for(let propName in template.properties) {
      env.property = propName;
      const v = evaluate(template.properties[propName], env);
      component.setProperty(propName, v);
    }
    if(template.componentType !== 'Canvas') {
      canvas.getTree().appendChild(component);
    } else {
      for(let i=0, len=template.children.length; i<len; i++)
        render(template.children[i]);
    }
  }
}

function findRecordSet (name) {
  if(this.name === name)
    return this;
  return findRecordSet.call(this.expand, name);
}

/**
 * Recurcively evaluate a given expression (The first expression is typically a formula)
 * @memberof Uvis
 * @private
 * @param {object} exp - the expression to evaluate
 * @param {object} env - the evaluation scope, variables that should be available at evaluation time
 * @return The computed value of an expression that can be assigned to a component
 */
function evaluate(exp, env) {
  function walkToMap (pathReader, env) {
    const form = env.form;
    const separator = evaluate(pathReader.next(), env);
    const index = pathReader.getIndex();
    const resourceName = evaluate(pathReader.next(), env);
    let data = null;
    if(env.property === 'Rows') {
      if(!pathReader.hasNext()) {
        if(env.template.parent) {
          return resourceName;
        } else {
          data = env.template.data[resourceName];
        }
        return data;
      }
    } else {
      let instance = env.template.instance;
      if(instance.hasOwnProperty(resourceName))
        instance = instance[resourceName];
      pathReader.next(); // separator
      if(index) {
        var indexValue = evaluate(index, env);
        if(indexValue >= env.instances.length)
          throw new Error("Null pointer exception");
        instance = env.instances[indexValue];
      }
      const fieldName = evaluate(pathReader.next(), env);
      if(env.template.parent) {
        const res = instance[fieldName];
        return res;
      } else {
        const res = env.template.data[resourceName][env.template.index][fieldName];
        return res;
     }
    }
  }

  function walkToForm (pathReader, env) {
    const separator = evaluate(pathReader.next(), env);
    const templateName = evaluate(pathReader.next(), env);
    const template = env.form.findTemplate(templateName);
    if(!template)
      throw new Error("Template '" + templateName + "' does not exits");
    
    if(env.property === 'Rows') {
      if(pathReader.hasNext()) {
        pathReader.next();
      } else {
        return template.instance;
      }
    } else {
      pathReader.next();
      const propertyName = evaluate(pathReader.next(), env);
      const property = template.properties[propertyName];
      // Try to read the cached value otherwise evaluates
      return property.cache || evaluate(property, env);
    }
  }

  function walkToParent (pathReader, env) {
    pathReader.next();
    const parent = env.template.parent;
    const propName = evaluate(pathReader.next(), env);
    const prop = parent.properties[propName];
    const tmpEnv = {
      form: env.form, map:env.map, template: parent, property: propName
    };
    const value = evaluate(prop, tmpEnv);
    return value;
  }

  // This function is not used. I started to write it in order to validate
  // the idea that a walkTo* function can be infered depending on a value
  // contained in one of them
  function inferValue(exp, env) {
    let tally = [];
    // lookup in parent
    if(env.template.parent) {
      const parent = env.template.parent;
      const property = parent.properties[exp.name];
      if(property)
        tally.parent = parent;
    }

    // lookup form
    var template = env.form.findTemplate(exp.value)
    if(template) {
      tally.template = template;
    }

    return exp;
  }

  function num(x) {
    if (typeof x != "number")
      throw new Error("Expected number but got " + x);
    return x;
  }

  function applyOpRows (op, left, right) {
    switch(op) {
      case '-<':
        return left[right];
      case '>-':
        return left;
      case 'WHERE':
        return left;
      case '<':
        return null;
      case '>':
        return null;
    }
  }

  function applyOpProps (op, left, right) {
    switch(op) {
      case '*' : return num(left) * num(right);
      case '+' :
        if(typeof left === 'number' && typeof right === 'number') {
          return num(left) + num(right);
        } else {
          return left + "" + right;
        }
      case '-' :
        return num(left) - num(right);
      default:
        throw new Error('Not yet implemented');
    } 
  }

  switch(exp.type) {
    case 'formula':
      return evaluate(exp.value, env);
    case 'binary':
      const left = evaluate(exp.left, env);
      const right = evaluate(exp.right, env);
      return (env.property === 'Rows') ? applyOpRows(exp.operator, left, right) : applyOpProps(exp.operator, left, right);
    case 'path':
      const pathReader = helpers.createPathReader(exp);
      const walkTo = evaluate(pathReader.next(), env);
      return walkTo(pathReader, env);
    case 'num':
    case 'str':
      return exp.value;
    case 'id':
      if(exp.value === 'index')  return env.template.index;
      if(exp.value === 'Map')    return walkToMap;
      if(exp.value === 'Form')   return walkToForm;
      if(exp.value === 'Parent') return walkToParent;
      return inferValue(exp.value, env);
      break;
  }
}

/**
 * Recurcively pre-evaluate a given expression (The first expression is typically a formula)
 * The pre-evaluation will use the template list provided in the environment in order to build a template tree
 * Further, it will build query models (JavaScript objects representing a query) on the appropriate templates.
 * @memberof Uvis
 * @private
 * @param {exp} the expression to pre-evaluate
 * @param {env} the evaluation scope, variables that should be available at pre-evaluation time
 * @return The computed value of an expression that can be assigned to a component
 */
function preEvaluate(exp, env) {
  function makeQueryModel (exp, env) {
    if(env.template.parent == null) {
      env.template.query = {
        type: 'query',
        name: relation.name,
        primaryKey: relation.primaryKey,
        foreignKeys: relation.foreignKeys,
        query: {},
        properties: [],
        expand:null,
        findRecordSet: findRecordSet
      }
      env.form.getTree().appendChild(env.template);
    }
  }

  function walkToForm (pathReader, env) {
    const separator = preEvaluate(pathReader.next(), env);
    const form = env.form;
    if(env.property === 'Rows') {
        const parent = form.findTemplate(preEvaluate(pathReader.next()), env);
        if(parent.visited === true)
          throw new Error("Cyclical parent reference !");
        parent.visited = true;
        const tmpEnv = {form: env.form, map: env.map, template: parent, property: 'Rows'}
        preEvaluate(parent.rows, tmpEnv);
        return parent;
    } else {
      if(pathReader.hasNext()) {
        return form.findTemplate(preEvaluate(pathReader.next(), env));
      } else {
        preEvaluate(pathReader.next(), env); // jump over separator
        const parentRef = preEvaluate(pathReader.next(), env);
        const parent = form.findTemplate(parentRef);
        parent.appendChild(env.template);
      }
    }
  }

  function walkToMap (pathReader, env) {
    const separator = preEvaluate(pathReader.next(), env);
    const map = env.map;
    const template = env.template;
    const resourceName = preEvaluate(pathReader.next(), env);
    const resource = map.getEntity(resourceName);
    if(env.property === 'Rows') {
      if(pathReader.hasNext()) {
        pathReader.next(); // skip separator
        //if(resourceName === 'activity');
        return { type: 'filter',
          resource: resourceName,
          field: preEvaluate(pathReader.next(), env)
        };
        //return {type:'entityProperty', value:preEvaluate(pathReader.next(), env)};
      } else {
        return resource;
      }
    } else {
      pathReader.next() // skip separator
      const propertyName = preEvaluate(pathReader.next(), env);
      const field = resource.getField(propertyName);
      let query = null;
      if(env.template.parent) {
        query = env.template.parent.query;
      } else {
        query = env.template.query;
      }
      query = query.findRecordSet(resourceName);
      query.properties.push(field);
    }
  }

  function walkToParent (pathReader, env) {
    const separator = preEvaluate(pathReader.next(), env);
    const property = preEvaluate(pathReader.next(), env);
    return env.template.parent.getProperty(property);
  }

  function applyOp(op, left, right) {
    if(op === '-<') {
      if(left.type === 'template' && right.type === 'resourceSchema') {
        left.query.expand = {
          type:'query',
          cardinality: 'many',
          name:right.name,
          primaryKey: right.primaryKey,
          foreignKeys: right.foreignKeys,
          properties: [],
          expand:null,
          filter:null,
          findRecordSet: findRecordSet
        };
        // add current template as child
        env.template.parent = left;
        left.children.push(env.template);
        return left.query;
      } else {
        throw new Error("Not yet implemented");
      }
    }

    if(op == '>-') {
      const activity = left.expand;
      if(left.type === 'query' && right.type === 'resourceSchema') {
        activity.expand = {
          type:'query',
          cardinality:'one',
          name:right.name,
          primaryKey: right.primaryKey,
          foreignKeys: right.foreignKeys,
          properties: [],
          expand:null,
          filter:null,
          findRecordSet: findRecordSet
        };
      }
      return left;
    }

    if(op === '>') {
      if(typeof left.type !== 'undefined' && left.type === 'filter') {
        return {type:'filter', target: left, op: op, value: right};
      }
    }

    if(op === '=') {
      if(typeof left.type !== 'undefined' && left.type === 'filter') {
        return {type:'filter', target: left, op: op, value: right};
      }
    }

    if(op === 'WHERE') {
      left.filter = right;
      return left;
    }

  }

  switch(exp.type) {
    case 'formula':
      env.template.updated = true;
      const relation = preEvaluate(exp.value, env);
      if(env.property === 'Rows')
        makeQueryModel(exp, env);
      break;

    case 'binary':
      const left  = preEvaluate(exp.left,  env);
      const right = preEvaluate(exp.right, env);
      if(env.property === 'Rows')
        return applyOp(exp.operator, left, right, env);
      break;

    case 'path':
      const pathReader = helpers.createPathReader(exp);
      const walkTo = preEvaluate(pathReader.next(), env);
      return walkTo(pathReader, env);

    case 'num':
    case 'str':
    case 'punc':
    case 'datetime':
      return exp.value.toString();

    case 'id':
      if(exp.value === 'index') return null;
      if(exp.value === 'Map') return walkToMap; 
      if(exp.value === 'Form') return walkToForm;
      if(exp.value === 'Parent') return walkToParent;

      return exp.value;
  }
}

/**
 * Reset the entire system. This is usefull if a screen has already been render, in order to unset all objects
 * @memberof Uvis
 */
function reset () {
  form.reset();
  canvas.reset();
}

/** @Global */
window.uvis = {
  addEventListener: function (name, fn) {
    //events[name] = fn;
    events.subscribe(name, fn);
  },
  saveVisfile: function (stream) {
    resourceProvider('visfile', {
      filename:map.getVisfileName(),
      method:'POST',
      content:stream
    }).then(function(result) {
      reset();
      run();
    }).catch(function (err) {
      throw new Error('failed to write the visfile', err);
    });
  },
  saveVismfile: function (stream) {
    resourceProvider('vismfile', {
      filename:initialVismfile,
      method:'POST',
      content: stream
    }).then(function (result) {
      reset();
      run();
    }).catch(function (err) {
      throw new Error('failed to write the vismfile', err);
    });
  },
  updateVismfile: function (filename) {
    system.setVismfileName(filename);
  },
  run:run,
  setRole: function (roleType) {
    role = roleType;
    toolBox.setRole(roleType);
    toolBox.render();
  },
  /*emit: function (name, args) {
    if(events[name])
      events[name](args);
  },*/
  getValidator: canvas.getValidator,
  registerValidator: canvas.registerValidator,
  registerComponent: canvas.registerComponent,
  config: function (userConfig) {
    browserValidator();
    const validConfig   = configValidator(userConfig);
    system.setResourceProvider(validConfig.resourceProvider);
    system.setPlaceholder(validConfig.selector);
    system.setVismfileName(validConfig.initialVismfile);
    system.setMode('designer');
  },
  getQueryTranslator: function (queryModel) {
    const selectedDbProvider = map.getSelectedDbProvider();
    const dbProvider = map.getProvider(selectedDbProvider);
    return dbProvider.translator;
  }
};
