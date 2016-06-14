const providerTypes = {};

let selectedProvider = "";
let source = "";

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
      const dbProvider = getProvider(selectedProvider);
      const dbSchema = dbProvider.parser(schemaStr);
      schema = dbProvider.mapper(vismSchema, dbSchema);
      resolve();
    }).catch(function (err) {
      reject(err);
    });

  });
}

function setStartUpFormName (name) {
  startUpFormName = name;
}

function getVisfileName () {
  return startUpFormName;
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
  return resourceProvider('visfile', {filename:startUpFormName, method: 'GET'});
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

function validateTypeParams() {

}

function registerProvider (name, params) {
  validateTypeParams(name, params);
  providerTypes[name] = params;
}

function getProvider (name) {
  return providerTypes[name];
}

function createResourceSchema() {
  const prototype = {
    getField: function (name) {
      for(var i=0, len=this.fields.length; i<len; i++) {
        if(this.fields[i].name === name) return this.fields[i];
      }
      throw new Error("No such field '" + name + "'");
    }
  };

  return Object.create(prototype);
}

function setupDefaultProviders () {
  registerProvider('pgsql', {

    mapper: function (sysSchema, extSchema) {
      var schema = {};
      for(let resourceName in sysSchema) {
        if(extSchema[resourceName]) {
          const extSchemaResource = extSchema[resourceName];
          const sysSchemaResource = sysSchema[resourceName];
          const resourceSchema = createResourceSchema();
          resourceSchema.type = 'resourceSchema';
          resourceSchema.name = resourceName;
          resourceSchema.fields = [];
          // copy all properties from external schema
          for (let i in extSchemaResource.fields) {
            const field = {
              name: extSchemaResource.fields[i].name,
              description: extSchemaResource.fields[i].description || undefined,
              type: extSchemaResource.fields[i].type
            }
            resourceSchema.fields.push(field);
          }
          resourceSchema.primaryKey = extSchemaResource.primaryKey;
          const foreignKeys = [];
          // build relations among resources relying on the internal schema
          for(let name in sysSchemaResource) {
            const foreignKey = {};
            foreignKey.fields = sysSchemaResource[name].on.from.fields;
            foreignKey.reference = {};
            foreignKey.reference.resource = name;
            foreignKey.reference.fields = sysSchemaResource[name].on.to.fields;
            foreignKeys.push(foreignKey);
          }
          resourceSchema.foreignKeys = foreignKeys;
          schema[resourceName] = resourceSchema;
        }
      }
      return schema;
    },
    parser: function (extSchema) {
      const schema = {};
      extSchema = JSON.parse(extSchema);
      for(let name in extSchema.resources) {
        var resource = extSchema.resources[name];
        schema[resource.name] = extSchema.schemas[resource.name];
      }

      return schema;
    },
    translator: function (queryModel) {
      function buildQuery (query, fk) {
        var select = []; 
        var $select, $from, $query;
        var json = [];

        for(var i in query.properties)
          select.push(query.properties[i].name);
          select = select.union(query.primaryKey);

        for(var i in select) {
          json.push("'" + select[i] + "', " + query.name + '.' + select[i]);
        }

        var $fk = (fk) ? fk.fields.toString() + ', ' : '';
        let $json_build_object = json.toString()

        if(query.expand)
          $json_build_object += ", '" + query.expand.name + "', " + query.expand.name + ".fields";

        if(query.cardinality === 'many') {
          if(fk) {
            $select = 'SELECT ' + $fk + 'json_agg(json_build_object(' + $json_build_object + ')) AS fields';
          } else {
            $select = 'SELECT ' + $fk + ', ' + select.toString();
          }
        } else {
            $select = 'SELECT ' + $fk + 'json_build_object(' + $json_build_object + ') AS fields';

            if(!fk)
              $select = 'SELECT ' + $fk + 'json_agg(json_build_object(' + $json_build_object + ')) AS ' + query.name;
        }
        $from   = 'FROM ' + query.name;
        $query  = $select + ' ' + $from;

        if(query.expand) {

          var fk, $join;

          for(var i in query.expand.foreignKeys) {
            if(query.expand.foreignKeys[i].reference.resource === query.name)
              fk = query.expand.foreignKeys[i];
          }

          $join  = 'LEFT JOIN (' + buildQuery(query.expand, fk) + ')'
          $join += ' AS ' + query.expand.name;
          $join += ' ON ' + fk.reference.resource + '.' + fk.reference.fields.toString()
          $join += ' = ' + query.expand.name + '.' + fk.fields.toString();

          $query += ' ' + $join;

        }
        if(query.cardinality === 'many') 
          $query += ' GROUP BY pid ';

        return $query;  
      }
      return buildQuery(queryModel);
    }
  });
}

function getSelectedDbProvider () {
  return selectedProvider;
}

function setDbInfo(provider, sourceStr) {
  selectedProvider = provider;
  source = sourceStr;
}

function hasSchemaDefinition() {
  return (Database.Provider !== null);
}

setupDefaultProviders();

export default {
  createEntity: createEntity,
  registerProvider: registerProvider,
  getProvider: getProvider,
  setDbInfo: setDbInfo,
  getSelectedDbProvider: getSelectedDbProvider,
  setStartUpFormName: setStartUpFormName,
  getVisfileName: getVisfileName,
  //setSchemaParser: setSchemaParser,
  //setSchemaMapper: setSchemaMapper,
  setDatabaseProvider: setDbProvider,
  setDatabaseSource: setDbSource,
  setVismSchema: setVismSchema,
  getEntity: getEntity,
  buildSchema: buildSchema,
  downloadForm: downloadForm,
  setResourceProvider: setResourceProvider,
  hasSchemaDefinition: hasSchemaDefinition,
  getSchema: function () {return schema;}
}
