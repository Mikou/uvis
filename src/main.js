import streamReader from './compiler/streamReader';
import tokenizer from './compiler/tokenizer';
import vismParser from './vismParser';
import visParser from './visParser';
import canvas from './canvas';
import formModule from './form';
import configValidator from './configValidator';
import visMapValidator from './visMapValidator';
import browserValidator from './browserValidator';

let initialVismfile = null;
let fileProvider = null;
let dbConnector = null;
let selector = null;
let visMap = null;
let oData = null;

window.uvis = {
  config: function (userConfig) {
    browserValidator();
    // We should also ensure that document.readyState == 'complete'
    // before validating the user configuration;
    const validConfig = configValidator(userConfig);
    initialVismfile = validConfig.initialVismfile;
    fileProvider = validConfig.fileProvider;
    dbConnector = validConfig.databaseConnector;
    selector = validConfig.selector;
  },
  run: function () {

    fileProvider(initialVismfile).then(function(stream) {
      vismParser.init({
        tokenizer: tokenizer(streamReader(stream))
      });
      visMap = vismParser.parse();

      visMapValidator(visMap, {
        dbConnector: dbConnector, 
        odatajs: odatajs,
        fileProvider: fileProvider}
      ).then(function (visMap) {
        const visCanvas = canvas.init({selector:selector});

        visParser.init({
          tokenizer: tokenizer(streamReader(visMap.startUpFormStream)), 
          canvas: visCanvas, 
          form: formModule
        });

        const form = visParser.parse();

        // preevaluate rows in order to build the template Tree
        const templateList = form.getTemplateList();

        for(var name in templateList) {
          const template = templateList[name];
          if(typeof template.rows !== 'undefined') {
            const env = {
              form: form,
              map: visMap,
              template: template
            }
            preEvaluate(template.getRows(), env);
          } else {
            form.getTree().appendChild(template);
          }
        }

        // preEvaluate all other properties
        
      }).catch(function(err) {

        const pre = document.createElement('pre');
        pre.appendChild(document.createTextNode("Error: " + err.message));
        pre.appendChild(document.createElement("hr"));
        pre.appendChild(document.createTextNode("stack trace:"));
        pre.appendChild(document.createElement("br"));
        pre.appendChild(document.createTextNode(err.stack));
        selector.appendChild(pre);
        throw (err);
      })
    });
  }
}

function createPathReader (path) {
  function next () {
    const value = peek();
    path = (value !== null) ? path.next : undefined;
    return value;
  }

  function hasNext() {
    return path !== 'undefined';
  }

  function peek () {
    if(typeof path === 'undefined') return null;
    return path.content;
  }

  return {
    hasNext: hasNext,
    next: next,
    peek: peek
  }
}


function preEvaluate(exp, env) {

  switch(exp.type) {
    case 'binary':
      var left = preEvaluate(exp.left, env);
      var right;
      if(exp.operator !== 'WHERE') {
        right = preEvaluate(exp.right, env);
      }
      return;

    case 'path':

      const pathReader = createPathReader(exp);
      const router = preEvaluate(pathReader.next(), env);
      router(pathReader);
      return;

    case 'id':

      if(exp.value === 'Map') return function (pathReader) {
        const separator = preEvaluate(pathReader.next(), env);
        const map = env.map;
        const template = env.template;
        if(template.entitiesReady) {

        } else {
          debugger;
          const entityRef = preEvaluate(pathReader.next(), env);
          map.copyEntity(entityRef);
        }
      }

      if(exp.value === 'Form') return function (pathReader) {
        preEvaluate(pathReader.peek().separator, env);
      }

      return exp.value;

    case 'punc':
      console.log("WE have a punctuation");
      return exp.value;
  }

}

/*export const uvis = function () {

  return {
    config: config
  }

}*/

/*var uvis = (function () {

  var service = {};
  var selector, fileProvider, initialVismfile;

  service.run = function () {
    
    fileProvider(initialVismfile).then(function (stream) {

      var vismfile = document.createElement('div');

      return fileProvider(initialVisfile);

    }).then(function (stream) {



    }).catch(function (err) {
      console.log("err", err);
      selector.appendChild(document.createTextNode("Something went wrong", err));
    });
  }

  service.config = function (userConfig) {

    if(typeof userConfig.fileProvider !== 'function')
      throw new Error("You must specify a fileProvider function");

    fileProvider = userConfig.fileProvider;

    if(typeof userConfig.initialVismfile !== 'string' || userConfig.initialVismfile === '')
      throw new Error("You must provide an initialVismfile as a string.");

    initialVismfile = userConfig.initialVismfile;

    if(typeof userConfig.selector !== 'string')
      throw new Error("You must provide an application selector");

    selector = document.getElementById(userConfig.selector);
    if(selector === null)
      throw new Error("The app selector is not valid");

  }

  return service;

})();*/
