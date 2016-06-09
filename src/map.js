let schema = undefined;
let schemaParser = undefined;
let schemaMapper = undefined;
let resourceProvider = undefined;
let vismSchema = null;
let startUpFormName = null;

const Database = {
  Provider: null,
  Source: null
}

function getEntity (name) {
  if(typeof schema === 'undefined')
    throw new Error("The schema has not been built yet!");
  return schema[name];
}

function setResourceProvider (fn) {
  if(typeof fn !== 'function')
    throw new Error("The file provider must be a function");

  resourceProvider = fn;
}

function buildSchema () {
  
  if(typeof resourceProvider === 'undefined')
    throw new Error('Resource provider missing');

  return new Promise(function (resolve, reject) {
    resourceProvider('dataSchema', Database.Source).then(function (schemaStr) {
      const dbSchema = schemaParser(schemaStr);
      schema = schemaMapper(vismSchema, dbSchema);
      resolve();

    }).catch(function (err) {
      reject(err);
    });
  });
}

function setStartUpFormName (name) {
  startUpFormName = name;
}

function setSchemaParser (schemaParserFn) {
  if(typeof schemaParserFn !== 'function')
    throw new Error("The schema parser must be a function");

  schemaParser = schemaParserFn;
}
function setSchemaMapper (schemaMapperFn) {
  if(typeof schemaMapperFn !== 'function')
    throw new Error("The schema mapper must be a function");

  schemaMapper = schemaMapperFn;
}

function setDbProvider (str) {
  Database.Provider = str;
}

function setDbSource (str) {
  Database.Source = str;
}


function setVismSchema (schema) {
  vismSchema = schema;
}

function downloadForm() {
  return resourceProvider('visfile', startUpFormName);
}

function createEntity(name) {
  
  if(!schema.hasOwnProperty(name))
    throw new Error("The requested resource '" + name + "' does not exist in the current context");
  const prototype = schema[name];
  const entity = {};

  entity.type = prototype.type;
  entity.name = prototype.name;
  entity.properties = {};
  for(let prop in prototype.properties) {
    entity.properties[prop] = prototype.properties[prop];
  }
  entity.relations = [];
  for(let i in prototype.relations) {
    entity.relations.push(prototype.relations[i]);
  }
  
  return entity;
}

export default {
  createEntity: createEntity,
  setStartUpFormName: setStartUpFormName,
  setSchemaParser: setSchemaParser,
  setSchemaMapper: setSchemaMapper,
  setDatabaseProvider: setDbProvider,
  setDatabaseSource: setDbSource,
  setVismSchema: setVismSchema,
  getEntity: getEntity,
  buildSchema: buildSchema,
  downloadForm: downloadForm,
  setResourceProvider: setResourceProvider,
  getSchema: function () {return schema;}
}
