let tree = undefined;
let templates = [];

function traverseTree (Template, cb) {
  cb(Template);
  for(var child in Template.children){
    traverseTree(Template.children[child], cb);
  }
}

function setTemplateName (name) {
  this.name = name;
}

function setFormulaForProperty(propName, formula) {
  this.properties[propName] = formula;
}

function setProperty(name, formula) {
  this.properties[name] = formula;
}

function getProperty (name) {
  if(this.properties.hasOwnProperty(name)) 
    return this.properties[name];
}

function appendChild (template) {
  if( (typeof template !== 'object') || (template.type !== 'template') )
    throw new Error("Not a valid template");
  this.children.push(template);
}

function getResource (name) {
  const data = this.data;
  debugger;
  if(data.name === name)
    return data.data;

  throw new Error("no such resource '" + name + "'.");
}

function createTemplate () {
  const templateProto = {
    setProperty: setProperty,
    getProperty: getProperty,
    getResource: getResource,
    appendChild: appendChild,
    setFormulaForProperty: setFormulaForProperty
  }
  
  const template = Object.create(templateProto, {
    name:          {writable: true, value: null},
    type:          {writable: false, value: 'template'},
    componentType: {writable: true, value: null},
    rows:          {writable: true, value: null},
    parent:        {writable: true, value: null},
    visited:       {writable: true, value: false},
    bundle:        {writable: true, value: []},
    properties:    {writable: true, value: {}},
    children:      {writable: true, value: []},
    query:         {writable: true, value: null}
  });
  
  return template;
}

function addTemplate (template) {
  templates.push(template)
}

function setTree(rootTemplate) {
  if(typeof rootTemplate !== 'object' || rootTemplate.type !== 'template')
    throw new Error("Not a valid template");

  tree = rootTemplate;  
}

function getTree () {
  return tree;
}

function getTemplateList () {
  return templates;
}

function findTemplate(name) {
  for(let i in templates) {
    if(templates[i].name === name)
      return templates[i];
  }
  return undefined;
  //throw new Error("No such template " + name);
}

function reset () {
  //tree = undefined;
  if(tree) {
    tree.children = [];
    templates = [];
  }
}

export default {
  createTemplate: createTemplate,
  addTemplate: addTemplate,
  setTree: setTree,
  getTree: getTree,
  traverseTree: traverseTree,
  getTemplateList: getTemplateList,
  findTemplate: findTemplate,
  reset: reset
}
