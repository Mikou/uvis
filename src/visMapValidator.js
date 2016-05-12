function fetchMetadata (database, oData) {

  return new Promise(function (resolve, reject) {

    const headers = { 
      'Accept': 'text/html,application/xml,application/json;odata.metadata=full',
      'Odata-Version': '4.0',
      'Odata-MaxVersion': '4.0',
      'Prefer': 'odata.allow-entityreferences'
    };  

    const request = { 
      headers:    headers,
      requestUri: database + "$metadata",
      data:       null
    };  

    const successCallback = function (response) {
      resolve(response.dataServices.schema[0]);  
    }

    const errorCallback = function (err) {
      reject(err);
    }

    oData.read(request, successCallback, errorCallback, oData.metadataHandler);
  });
}

function compareSchemas (dbSchema, userSchema) {

  const visSchema = {};

  function lookupEntitySet (name) {
    const entitySet = dbSchema.entityContainer.entitySet;
    const namespace = dbSchema.namespace;
    for(var i in entitySet) {
      const set = entitySet[i];
      if(name === set.name)
        return set;
    }
    return null;
  }

  function lookupEntityType (name) {
    const namespace = dbSchema.namespace;
    for(var i in dbSchema.entityType) {
      const type = dbSchema.entityType[i];
      if(namespace + "." + type.name === name) {
        return type;
      }
    }
  }

  for(let entityName in userSchema) {
    const entity = {
      type: 'entity',
      name: entityName,
      properties: {}
    };

    const entitySet  = lookupEntitySet(entityName);
    if(entitySet === null)
      throw new Error("The data service contains no entitySet with name " + entitySetName);
    
    const entityType = lookupEntityType(entitySet.entityType);
    if(entityType === null)
      throw new Error("The data service contains no entityType with name " + entitySet.entityType);

    // for now we only accept a single primary key
    // in the futur we might need to extend this in order to support composite keys
    var pKey = entityType.key[0].propertyRef[0].name;

    for(var i in entityType.property) {
      var property = entityType.property[i];
      entity.properties[property.name] = {
        type: 'entityProperty',
        isPKey: pKey === property.name,
        propType: convertODataType(property.type)
      }
    }
    visSchema[entityName] = entity;
  }

  function convertODataType (type) {
    switch(type) {
      case "Edm.Int32":
        return "Number";
      case "Edm.String":
        return "String";
      case "Edm.Date":
        return "Date";
      default:
        throw new Error("Unrecognized type " + type);
        return;
    }
  }
  return visSchema;
}

export default function (visMap, config) {
  return new Promise (function (resolve, reject) {

    fetchMetadata(visMap.database, config.odatajs.oData).then(function (dbSchema) {

      const userSchema = visMap.schema;
      try {
        const visSchema = compareSchemas(dbSchema, userSchema);
        visMap.schema = visSchema;
      } catch(err) {
        reject(err);
      }

      visMap.getEntity = function (entityName) {
        if(this.schema[entityName]) {
        }
      }

      visMap.copyEntity = function () {
      }

      config.fileProvider(visMap.startUpForm).then(function (visStream) {

        visMap.startUpFormStream = visStream;
        resolve(visMap);

      });

    }).catch(function(err) {
      reject(err);
    });

    /*}).catch(function(err) {

      reject(err);
      //reject("The connection to the database is not available");

    });*/


  });

}
