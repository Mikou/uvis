function defaultSchemaProvider (uri) {

  return new Promise(function (resolve, reject) {
    const xhr = new XMLHttpRequest();

    xhr.open("GET", uri+ '/$metadata');
    xhr.send();
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4 && xhr.status == 200) {
        var stream = xhr.responseText;
        resolve(stream);
         // Action to be performed when the document is read;
      }
    };
  });
}

function defaultSchemaParser (stream) {

  // credit: https://davidwalsh.name/convert-xml-json
  // Changes XML to JSON
  function xmlToJson(xml) {
    
    // Create the return object
    var obj = {};

    if (xml.nodeType == 1) { // element
      // do attributes
      if (xml.attributes.length > 0) {
      obj["@attributes"] = {};
        for (var j = 0; j < xml.attributes.length; j++) {
          var attribute = xml.attributes.item(j);
          obj["@attributes"][attribute.nodeName] = attribute.nodeValue;
        }
      }
    } else if (xml.nodeType == 3) { // text
      obj = xml.nodeValue;
    }

    // do children
    if (xml.hasChildNodes()) {
      for(var i = 0; i < xml.childNodes.length; i++) {
        var item = xml.childNodes.item(i);
        var nodeName = item.nodeName;
        if (typeof(obj[nodeName]) == "undefined") {
          obj[nodeName] = xmlToJson(item);
        } else {
          if (typeof(obj[nodeName].push) == "undefined") {
            var old = obj[nodeName];
            obj[nodeName] = [];
            obj[nodeName].push(old);
          }
          obj[nodeName].push(xmlToJson(item));
        }
      }
    }
    return obj;
  };
  
  const xmlSchema = ( new window.DOMParser() ).parseFromString(stream, "text/xml");
  return xmlToJson(xmlSchema);

}


function defaultSchemaMapper (vismSchema, dbSchema) {

  dbSchema = dbSchema['edmx:Edmx']['edmx:DataServices'].Schema;
  const namespace = dbSchema['@attributes'].Namespace;

  function convertODataType (type) {
    switch(type) {
      case "Edm.Int32":
        return "Number";
      case "Edm.String":
        return "String";
      case "Edm.Date":
        return "Date";
      default:
        throw new Error("unknown type:" + type);
    }
  }

  function getEntityType (name) {
    for(let i in dbSchema.EntityType) {
      const entityType = dbSchema.EntityType[i];
      const fullyQualifiedName = namespace + "." + entityType['@attributes'].Name;
      if(fullyQualifiedName === name) return entityType;
    } 
    throw new Error("entityType " + name + " not found in the schema");
  }
  
  function getEntitySet (name) {
    const entityContainer = dbSchema.EntityContainer; 
    for(let i in entityContainer.EntitySet) {
      let entitySet = entityContainer.EntitySet[i];
      if(name === entitySet['@attributes'].Name) return entitySet;
    }
    throw new Error("entitySet " + name + " not found in the schema");
  }

  const schema = {};
  for(let entityRef in vismSchema) {
    const visEntity = {
      type:'entity',
      name: entityRef, 
      properties: {},
      relations: []
    };
    const entitySet = getEntitySet(entityRef);
    const entityType = getEntityType(entitySet['@attributes'].EntityType);
    const pKey = entityType.Key.PropertyRef['@attributes'].Name;
    if(entityType.Property instanceof Array) {
      for(let propertyRef in entityType.Property) {
        const property = entityType.Property[propertyRef];
        visEntity.properties[property['@attributes'].Name] = {
          type: 'entityProperty',
          isPKey: (pKey === property['@attributes'].Name),
          isCandidate: false,
          propertyType: convertODataType(property['@attributes'].Type)
        }
      }
    } else {
      throw new Error("single property entities not supported yet");
    }
    schema[entityRef] = visEntity;
  }

  return schema;

}


