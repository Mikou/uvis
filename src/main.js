import streamReader from './compiler/streamReader';
import tokenizer from './compiler/tokenizer';
import vismParser from './vismParser';
import visParser from './visParser';
import map from './map';
import canvas from './canvas';
import form from './form';
import configValidator from './configValidator';
import visMapValidator from './visMapValidator';
import browserValidator from './browserValidator';
import toolBox from './toolBox';

let initialVismfile = null;
let visfile = null;
let resourceProvider = null;
let selector = null;
let role = "endUser";
let screen = document.createElement('div');
screen.id = "screen";
  const h1 = document.createElement('h1');
  h1.innerHTML = "Screen";
  screen.appendChild(h1);


const events = {};

function saveVismFile (filename, stream) {

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
}

function openVisfile () {
  selector.appendChild(screen);
  toolBox.create(selector);
  toolBox.setRole(role);
  toolBox.setSaveVismfileMethod(saveVismFile);

  return new Promise( function (resolve, reject) {

    resourceProvider('vismfile', {
    filename:initialVismfile, 
      method:'GET'
    }).then(function(stream) {

      toolBox.setVismfile(initialVismfile, stream);
      //toolBox.renderVismfile(stream, initialVismfile, role);
      const vismfileCallback = events['vismFileLoaded'];
      if(typeof vismfileCallback === 'function')
        vismfileCallback(stream);

      map.setResourceProvider(resourceProvider);

      vismParser.init({
        tokenizer: tokenizer(streamReader(stream)),
        map:map
      });

      vismParser.parse();
      if(map.hasSchemaDefinition()) {
        map.buildSchema().then(function () {
          resolve(map.downloadForm());
        });
      } else {
        resolve(map.downloadForm());
      }
    }).catch(function(err) {
      reject(new Error(err));
    });
  });
}

function getDataInstances(visStream) {
  return new Promise( function (resolve, reject) {
    //toolBox.renderVisfile(visStream, map.getVisfileName(), role);
    visParser.init({
      tokenizer: tokenizer(streamReader(visStream)), 
      canvas: canvas, 
      form: form
    });

    visParser.parse();

    // preevaluate rows in order to build the template Tree
    const templateList = form.getTemplateList();

    for(let name in templateList) {
      const template = templateList[name];
      if(template.rows) {
        const env = {form: form, map: map, template: template, property: 'Rows'};
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

    const dataQueue = [];

    for(let i in templateList) {
      if(templateList[i].query) {
        dataQueue.push(resourceProvider('query', {template:templateList[i], source: map.getDbInfo().Source}));
      }
    }

    resolve(Promise.all(dataQueue));
  });
}

function generateScreen(dataInstances) {
  const templateList = form.getTemplateList();
  canvas.createHTMLCanvas(screen);
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
            const r = evaluate(property, env);
            // caches the evaluated value on the property so that it can be
            // returned immediatelly if requested by another template
            // this saves the cost of an unecessary evaluation if a property
            // was already evaluated once
            property.cache = r;
            component.setProperty(propertyName, r);
          }
          canvas.getTree().appendChild(component);
          if(template.children) {
            for(let i=0, len=template.children.length; i<len; i++) {
              render(template.children[i]);
            }
          }
        }
      }
    } else {
      const tmpCanvas = canvas;
      const component = (template.componentType === 'Canvas') ? canvas.getTree() : canvas.createComponent(template.componentType);
      const env = {form:form, template: template};
      for(let propName in template.properties) {
        env.property = propName;
        const v = evaluate(template.properties[propName], env);
        component.setProperty(propName, v);
      }
      if(template.componentType !== 'Canvas')
        canvas.getTree().appendChild(component);
      if(template.children) {
        for(let i=0, len=template.children.length; i<len; i++) {
          render(template.children[i]);
        }
      }
    }
  }
  const tree = form.getTree();
  render(form.getTree());
}

function createPathReader (path) {
  function next () {
    const value = peek();
    path = (value !== null) ? path.next : undefined;
    return value;
  }
  function hasNext() {
    return (typeof path !== 'undefined');
  }
  function peek () {
    if(typeof path === 'undefined') return null;
    return path.content;
  }
  function getIndex () {
    return path.index;
  }

  return {
    hasNext: hasNext,
    next: next,
    peek: peek,
    getIndex: getIndex
  }
}

function findRecordSet (name) {
  if(this.name === name)
    return this;
  return findRecordSet.call(this.expand, name);
}

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

  function applyOp (op, left, right) {
    function num(x) {
      if (typeof x != "number")
        throw new Error("Expected number but got " + x);
      return x;
    }

    switch(op) {
      case '*' : return num(left) * num(right);
      case '+' :
        if(typeof left === 'number' && typeof right === 'number')
          return num(left) + num(right);
        return left + "" + right;
      case '-' :
        if(typeof left === 'number' && typeof right === 'number')
          return num(left) - num(right);

      case '<':
        return null;
      case '>':
        return null;
      case '-<':
        return left[right];
      case '>-':
        return left;
      case 'WHERE':
        return left;
      
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
      return applyOp(exp.operator, left, right);
    case 'path':
      const pathReader = createPathReader(exp);
      const router = evaluate(pathReader.next(), env);
      return router(pathReader, env);
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

function preEvaluate(exp, env) {

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
      const relation = preEvaluate(exp.value, env);
      if(env.property === 'Rows' && env.template.parent == null) {
        if(env.template.query) return;
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
        env.template.updated = true;
        env.form.getTree().appendChild(env.template);
      }
      return;

    case 'binary':
      const left  = preEvaluate(exp.left,  env);
      const right = preEvaluate(exp.right, env);
      return applyOp(exp.operator, left, right, env);

    case 'path':
      const pathReader = createPathReader(exp);
      const walkTo = preEvaluate(pathReader.next(), env);
      return walkTo(pathReader);

    case 'num':
    case 'str':
      return exp.value;

    case 'id':
      if(exp.value === 'Map') return function (pathReader) {
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

      if(exp.value === 'Form') return function (pathReader) {
        const separator = preEvaluate(pathReader.next(), env);
        const form = env.form;

        if(env.property === 'Rows') {

            const parent = form.findTemplate(preEvaluate(pathReader.next()), env);
            if(!parent.query) {
              if(parent.visited === true)
                throw new Error("Cyclical parent reference !");
              parent.visited = true;
              const tmpEnv = {form: env.form, map: env.map, template: parent, property: 'Rows'}
              preEvaluate(parent.rows, tmpEnv);
            }
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

      if(exp.value === 'Parent') return function (pathReader) {
        const separator = preEvaluate(pathReader.next(), env);
        const property = preEvaluate(pathReader.next(), env);
        return env.template.parent.getProperty(property);
      }
      return exp.value;

    case 'punc':
      return exp.value;

    case 'datetime':
      if(!exp.value.isValid()) throw new Error("Invalid date");
      return exp.value.toString();
  }
}

function reset () {
  visfile = null;

  //map.reset();
  form.reset();
  canvas.reset();
}

window.uvis = {
  addEventListener: function (name, fn) {
    events[name] = fn;
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
  openVismFile: function (filename) {
    initialVismfile = filename;
    reset(); 
    const startEventHandler = events['renderingStart'];
    if(typeof startEventHandler === 'function')
    startEventHandler();

    openVisfile().then(function (visStream) {

      toolBox.setVisfile(map.getVisfileName(), visStream);
      toolBox.render();
      return getDataInstances(visStream)
    }).then(function(dataInstances) {
      generateScreen(dataInstances);

      const endEventHandler = events['renderingSucceeded'];
      if(typeof endEventHandler === 'function')
      endEventHandler();

    }).catch(function (err) {
      canvas.createHTMLCanvas(screen);
      const homeBtn  = canvas.createComponent("NavBtn");
      const errorBox = canvas.createComponent("TextBox");
      const tree = canvas.getTree();

      tree.appendChild(errorBox);
      tree.appendChild(homeBtn);

      homeBtn.setProperty("Top", 10);
      homeBtn.setProperty("Left", 10);
      homeBtn.setProperty("BackgroundColor", "DarkGray");
      homeBtn.setProperty("Color", "White");
      homeBtn.setProperty("Border", 1);
      homeBtn.setProperty("Text", "Home");
      homeBtn.setProperty("GoTo", "/");

      errorBox.setProperty("Top", 100);
      errorBox.setProperty("Text", err.message);
      errorBox.setProperty("Width", Math.round(errorBox.measureText()) + 20);
      errorBox.setProperty("BackgroundColor", "DarkRed");
      errorBox.setProperty("Color", "White");
      console.log(err);
    });
  },
  setRole: function (roleType) {
    role = roleType;
    toolBox.setRole(roleType);
    toolBox.render();
  },
  emit: function (name, args) {
    if(events[name])
      events[name](args);
  },
  getValidator: canvas.getValidator,
  registerValidator: canvas.registerValidator,
  registerComponent: canvas.registerComponent,
  config: function (userConfig) {
    browserValidator();
    const validConfig = configValidator(userConfig);
    initialVismfile   = validConfig.initialVismfile;
    resourceProvider  = validConfig.resourceProvider;
    selector          = validConfig.selector;
  },
  getQueryTranslator: function (queryModel) {
    const selectedDbProvider = map.getSelectedDbProvider();
    const dbProvider = map.getProvider(selectedDbProvider);
    return dbProvider.translator;
  }
};
