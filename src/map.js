let schema = undefined;
let schemaProvider = undefined;
let fileProvider = undefined;

function fetchVismFile (name) {

  if(typeof fileProvider === 'undefined')
    throw new Error('You have not provided a file provider method');
  
  return new Promise(function (resolve, reject) {
    fileProvider(name).then(function(stream) {
      resolve(stream);
    }).catch(function(err) {
      reject(err);
    });
  });
}

function getEntity (name) {
  if(typeof schema === 'undefined')
    throw new Error("The schema has not been built yet!");
  return schema[name];
}

function setFileProvider (fileProviderFn) {
  if(typeof fileProvider !== 'function')
    throw new Error("The file provider must be a function");

  fileProvider = fileProviderFn;
}

function buildSchema (vismSchema) {
  if(typeof schemaProvider === 'undefined')
    throw new Error('You have not provided a schema provider method');
 
  return new Promise(function (resolve, reject) {
    schemaProvider(vismSchema).then(function (validSchema) {

      schema = validSchema;
      resolve(schema);

    }).catch(function (err) {
      reject(err);
    });
  });
}

function setSchema(validSchema) {
  schema = validSchema;
}

function setSchemaProvider (schemaProviderFn) {
  if(typeof fileProvider !== 'function')
    throw new Error("The schema maker must be a function");

  schemaProvider = schemaProviderFn;
}

export default {
  setSchemaProvider: setSchemaProvider,
  getEntity: getEntity,
  setFileProvider: setFileProvider,
  fetchVismFile: fetchVismFile,
  setSchema: setSchema
}
