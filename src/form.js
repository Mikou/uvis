let tree = undefined;
const templates = [];

function setTemplateName (name) {
  this.name = name;
}

function setFormulaForProperty(propName, formula) {
  this.properties[propName] = formula;
}

function getComponentType() {
  return this.componentType;
}

function setComponentType(name) {
  if(typeof name !== 'string')
    throw new Error("The component name must be defined as a string");

  this.componentType = name;
}

function setRows (formula) {
  this.rows = formula;
}

function getRows () {
  return this.rows;
}

function setProperty(name, formula) {
  this.properties[name] = formula;
}

function appendChild (template) {
  if( (typeof template !== 'object') || (template.type !== 'template') )
    throw new Error("Not a valid template");

  this.children.push(template);
}

function createTemplate () {

  const template = {
    type: 'template',
    componentType: undefined,
    name: '',
    rows: undefined,
    bundle: [],
    properties: {},
    children: [],
    query: {},
    entities: [],
    entitiesReady:false,
    setName: setTemplateName,
    getRows: getRows,
    setRows: setRows,
    setProperty: setProperty,
    appendChild: appendChild,
    setComponentType: setComponentType,
    getComponentType: getComponentType,
    setFormulaForProperty: setFormulaForProperty
  };

  templates.push(template);
  return template;

}

function setTree(rootTemplate) {
  if(typeof rootTemplate !== 'object' || rootTemplate.type !== 'template')
    throw new Error("Not a valid template");

  tree = rootTemplate;  
}

function getTree () {
  return tree || undefined;
}

function getTemplateList () {
  return templates;
}

export default {
  createTemplate: createTemplate,
  setTree: setTree,
  getTree: getTree,
  getTemplateList: getTemplateList
}
