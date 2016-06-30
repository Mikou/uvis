/** @namespace Map */
const providerTypes = {};
let system = null;
let schema = undefined;
let resourceProvider = undefined;
let vismSchema = null;
let rowsLimit = null;
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
  
  return new Promise(function (resolve, reject) {
    const resourceProvider = system.getResourceProvider();
    const dbProvider = providerTypes[Database.Provider];
    resourceProvider('dataSchema', {
        method:'GET',
        source: Database.Source,
      }).then(function (schemaStr) {
      const dbSchema = dbProvider.parser(schemaStr);
      schema = dbProvider.mapper(vismSchema, dbSchema);
      resolve();
    }).catch(function (err) {
      reject(err);
    });

  });
}

function setVismSchema (schema) {
  vismSchema = schema;
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


/**
 * Validation of the configuration for a type
 * @memberof Map
 * @param {object} configuration object
 */
function validateTypeParams(config) {
  // do some validation on the provided params
}

/**
 * Register a new dbProvider type
 * @memberof Map
 * @param {name} name of the provider type
 * @param {config} configuration object holding the type specifications.
 */
function registerProvider (name, config) {
  validateTypeParams(name, config);
  providerTypes[name] = config;
}

/**
 * Return a given provider type
 * @param {name} name of the provider type
 * @memberof Map
 * @return {object} dbProvider
 */
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

/**
 * Setup the default built-in database providers
 * @memberof Map
 */

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
          // build relations between resources relying on the internal schema
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
  return providerTypes[Database.Provider];
  //return Database.Provider;
}

function setDbInfo(provider, sourceStr) {
  Database.Provider = provider;
  Database.Source = sourceStr;
}
function getDbInfo() {
  return Database;
}

function hasSchemaDefinition() {
  return (Database.Provider !== null);
}

function setSystem (module) {
  system = module;
}

setupDefaultProviders();

function setRowsLimit (num) {
  rowsLimit = num;
}

export default {
  setSystem:setSystem,
  createEntity: createEntity,
  registerProvider: registerProvider,
  setDbInfo: setDbInfo,
  getDbInfo: getDbInfo,
  getProvider: getProvider,
  getSelectedDbProvider: getSelectedDbProvider,
  setVismSchema: setVismSchema,
  getEntity: getEntity,
  buildSchema: buildSchema,
  setResourceProvider: setResourceProvider,
  hasSchemaDefinition: hasSchemaDefinition,
  getSchema: function () {return schema;},
  setRowsLimit: setRowsLimit
}
