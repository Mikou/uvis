let selector   = undefined;
let HTMLCanvas = null;
let context    = undefined;// = HTMLCanvas.getContext("2d");
const types = {};
const validators = {};
let tree = undefined;

let baseProperties = null;

function reflow (context) {
  traverseTree(tree, function(Component) {
    Component.draw(context);
  });
}

function getType (name) {
  if(typeof types[name] === 'undefined')
    throw new Error("Type '" + name + "' does not exist.");

  return types[name];
}

function setType(name, params) {
  if(typeof types[name] !== 'undefined')
    throw new Error("A Type with name '" + name + "' already exists.");

  types[name] = params;
}

function traverseTree (Component, cb) {
  cb(Component);
  for(var child in Component.children){
    traverseTree(Component.children[child], cb);
  }
}
function genericDraw (context) {
  var l = this.getProperty("Left").getValue();
  var t = this.getProperty("Top").getValue();
  var w = this.getProperty("Width").getValue();
  var h = this.getProperty("Height").getValue();

  //reflow(context); // repaints the entire screen

  context.beginPath()
  context.fillStyle = this.getProperty("BackgroundColor").getValue();
  context.strokeStyle = this.getProperty("Color").getValue();
  context.rect(l, t, w, h);
  context.fill();
  context.stroke();
  context.closePath();
}

function createBaseComponent () {
  var Component = {
    children: [],
    properties: {
			Top   : createProperty('Top',    {initialValue:10,      validator:getValidator('integer')}),
	    Left  : createProperty('Left',   {initialValue:10,      validator:getValidator('integer')}),
  	  Width : createProperty('Width',  {initialValue:100,     validator:getValidator('integer')}),
  	  Height: createProperty('Height', {initialValue:50,      validator:getValidator('integer')}),
  	  Color: createProperty('Color',   {initialValue:'Black', validator:getValidator('color')}),
  	  BackgroundColor: createProperty('BackgroundColor', {initialValue:'White', validator:getValidator('color')})
		},
    draw: genericDraw,
    getProperty: function (name) {
      // (1) lookup in the local properties
      for(var prop in this.properties) {
        if(name === prop) return this.properties[prop];
      }

      // (2) otherwise lookup in the prototype's properties
      var prototype = Object.getPrototypeOf(this);

      if(prototype.hasOwnProperty('properties')) {
        return this.getProperty.call(prototype, name);
      }

      // (3) finally if property does not exist
      throw new Error("property " + name + " does not exist.");
    },
    setProperty: function (name, value) {
      var property = this.getProperty(name);
      property.setValue(value);
      return property;
    },
    resetProperty: function (name) {
      var property = this.getProperty(name);
      property.resetValue();
    },
    appendChild: function (Component) {
      this.children.push(Component);
      reflow(context);
    }
  };

  return Component;
}

function createProperty (name, params) {
  var Property = {
    name: name,
    initialValue: params.initialValue,
    computedValue: undefined,
    validator: params.validator,
    getValue: function () {
      if(typeof this.computedValue !== 'undefined')
        return this.computedValue;

      return this.initialValue;
    },
    setValue: function (value) {
      this.validator(value);
      this.computedValue = value;
      reflow(context);
    },
    resetValue: function () {
      this.computedValue = undefined;
      reflow(context);
    }
  };

  return Property;
}

function validateTypeParameters (name, typeParams) {
  
  var properties = typeParams.properties;
  
  // verify keys
  for(var prop in properties) {
    if(!typeParams.properties[prop].hasOwnProperty('initialValue'))
      throw new Error("missing key: 'initialValue'");
    if(!typeParams.properties[prop].hasOwnProperty('validator'))
      throw new Error("missing key: 'validator'");
  }

  // the name must be different from the name of the type to extend
  if(typeParams.extends === name)
    throw new Error("The Type name ('" + name + "') cannot be the same as the Type to extend");

  // the provided initialValue should pass the validation for all properties
  for(var prop in properties) {
    typeParams.properties[prop].validator(typeParams.properties[prop].initialValue, prop);  
  }
  
}

function registerComponent (name, typeParams) {
  
  validateTypeParameters(name, typeParams);

  setType(name, typeParams);

}

// Background reading about inheritence in javascript
// http://www.crockford.com/javascript/inheritance.html
// http://javascript.crockford.com/prototypal.html
function createComponent (type) {
  var T = getType(type);
  var Component;
  var prototype;

  // if the component does not extend another component
  // then, the prototype must be the base component
  if(typeof T.extends === 'undefined'){
    prototype = createBaseComponent();
  } else {
    // recurcively calls the maker function.
    // parasitic inheritance pattern.
    prototype = createComponent(T.extends);
  }

  // Object.create(prototype) is equivalent to:
  // function F() {};
  // F.prototype = prototype;
  // Component = new F();
  Component = Object.create(prototype);
  Component.properties = {};

  for(var prop in T.properties) {
    Component.properties[prop] = createProperty(prop, T.properties[prop]);
  }

  for(var key in T) {
    if(key === 'properties' || key === 'extends') continue;

    Component[key] = T[key];
  }

  return Component;
}

function getComponentType (type) {
  if(types.hasOwnProperty(type))
    return types[type];
  return undefined;
}

function inspect (type, property) {
  const T = types[type];
  if(typeof T === 'undefined' || !property)
    return T;
  const properties = T.properties;
  if(properties.hasOwnProperty(property)) {
    return properties[property];
  } else if(T.extends) {
    throw new Error('NOT YET IMPLEMENTED');
  } else if(baseProperties.hasOwnProperty(property)) {
    return baseProperties[property];
  }

  return undefined;
}



function getPropertyForComponentType(name, typeRef) {
  const type = getComponentType(typeRef);
  if(!type) throw new Error("The requested Component Type "+typeRef+" does not exist");

  const properties = type.properties;
  if(properties.hasOwnProperty(name)) {
    return properties[name];
  } else if(typeof type.extends !== 'undefined') {
    // should recurcively lookup prototype chain
    // getPropertyForComponentType(name, type.extends);
    throw new Error("NOT YET IMPLEMENTED");
  } else {
    // lookup base type
    for(let propName in baseProperties) {
      if(propName === name)
        return baseProperties[propName];
    }
  }
  return undefined;
}

function registerValidator (name, fn) {
  if(typeof name !== 'string')
    throw new Error("The first argument must be a string");

  if(typeof fn !== 'function')
    throw new Error("The second argument must be a function");

  validators[name] = fn;
}

function getValidator (name) {
  if(typeof validators[name] === 'undefined')
    throw new Error('No validator with name ' + name + ' was found.');
  return validators[name];
}

function setupBuiltInValidators () {
  registerValidator('integer', function (input, propertyName) { 
    if(typeof input !== 'number' || input % 1 !== 0)
      throw new Error("the provided input cannot be recognized as an 'integer' for property '" + propertyName + "'.");
  });
  registerValidator('string', function (input, propertyName) { 
    if(typeof input !== 'string')
      throw new Error("the provided input cannot be recognized as a 'string' for property '" + propertyName + "'.");
  });
  registerValidator('textAlignment', function (input, propertyName) {
    var strValidator = getValidator('string');
    strValidator(input);

    if((input === 'center') || (input === 'left') || (input === 'right')) return;
      
    throw new Error("the provided input '"+input+"' for property '" + propertyName + "' must be one of 'center', 'left' or 'right'.");
  });
  registerValidator('color', function (input, propertyName) {
    var CSS_COLOR_NAMES = ["AliceBlue","AntiqueWhite","Aqua","Aquamarine","Azure","Beige","Bisque","Black","BlanchedAlmond","Blue","BlueViolet","Brown","BurlyWood","CadetBlue","Chartreuse","Chocolate","Coral","CornflowerBlue","Cornsilk","Crimson","Cyan","DarkBlue","DarkCyan","DarkGoldenRod","DarkGray","DarkGrey","DarkGreen","DarkKhaki","DarkMagenta","DarkOliveGreen","Darkorange","DarkOrchid","DarkRed","DarkSalmon","DarkSeaGreen","DarkSlateBlue","DarkSlateGray","DarkSlateGrey","DarkTurquoise","DarkViolet","DeepPink","DeepSkyBlue","DimGray","DimGrey","DodgerBlue","FireBrick","FloralWhite","ForestGreen","Fuchsia","Gainsboro","GhostWhite","Gold","GoldenRod","Gray","Grey","Green","GreenYellow","HoneyDew","HotPink","IndianRed","Indigo","Ivory","Khaki","Lavender","LavenderBlush","LawnGreen","LemonChiffon","LightBlue","LightCoral","LightCyan","LightGoldenRodYellow","LightGray","LightGrey","LightGreen","LightPink","LightSalmon","LightSeaGreen","LightSkyBlue","LightSlateGray","LightSlateGrey","LightSteelBlue","LightYellow","Lime","LimeGreen","Linen","Magenta","Maroon","MediumAquaMarine","MediumBlue","MediumOrchid","MediumPurple","MediumSeaGreen","MediumSlateBlue","MediumSpringGreen","MediumTurquoise","MediumVioletRed","MidnightBlue","MintCream","MistyRose","Moccasin","NavajoWhite","Navy","OldLace","Olive","OliveDrab","Orange","OrangeRed","Orchid","PaleGoldenRod","PaleGreen","PaleTurquoise","PaleVioletRed","PapayaWhip","PeachPuff","Peru","Pink","Plum","PowderBlue","Purple","Red","RosyBrown","RoyalBlue","SaddleBrown","Salmon","SandyBrown","SeaGreen","SeaShell","Sienna","Silver","SkyBlue","SlateBlue","SlateGray","SlateGrey","Snow","SpringGreen","SteelBlue","Tan","Teal","Thistle","Tomato","Turquoise","Violet","Wheat","White","WhiteSmoke","Yellow","YellowGreen"];

    var strValidator = getValidator('string');
    strValidator(input);

    // regex matching #abc and #abcdef
    if(/^#([0-9a-f]{3}){1,2}$/i.test(input)) return;

    for(var color in CSS_COLOR_NAMES)
      if(input === CSS_COLOR_NAMES[color])
        return;

    throw new Error("the provided input '"+input+"' for property '" + propertyName + "' cannot be recognized as a valid 'color'.");


  });
}

function setupBuiltInComponents () {

  registerComponent('TextBox', {
    properties:{
      Text:{
        initialValue:'No Text', 
        validator: getValidator('string')
      }, 
      TextAlignment: {
        initialValue:'left',
        validator: getValidator('textAlignment')
      },
      FontSize: {
        initialValue:14,
        validator: getValidator('integer')
      },
      FontFamily: {
        initialValue:'Arial',
        validator: getValidator('string')
      }
    },
    draw: function(context) {

      var prototype = Object.getPrototypeOf(this);

      var posX = this.getProperty("Left").getValue();
      var posY = (this.getProperty("Top").getValue() + this.getProperty("Height").getValue() / 2) + (this.getProperty("FontSize").getValue() / 2.5);

      var font = this.getProperty("FontSize").getValue() + "px " + this.getProperty("FontFamily").getValue();
      var text = this.getProperty("Text").getValue();
      var align = this.getProperty("TextAlignment").getValue();
      var textWidth = context.measureText(text).width;

      if(align === 'right') {
        posX = this.getProperty("Left").getValue() + this.getProperty("Width").getValue() - 10;
      } else if(align === 'center') {
        posX = this.getProperty("Left").getValue() + this.getProperty("Width").getValue() / 2;
      } else {
        posX = posX + 10;
      }

      // draw the box
      prototype.draw(context);

      context.font=font;
      context.textAlign = align;
      context.fillStyle = this.getProperty("Color").getValue();
      context.fillText(text ,posX ,posY);

    }
  })
}

function getTree () {

  if(typeof tree === 'undefined') {
    tree = createBaseComponent()

    tree.getProperty("Top").setValue(0);
    tree.getProperty("Left").setValue(0);
    tree.getProperty("Width").setValue(640);
    tree.getProperty("Height").setValue(480);
    tree.getProperty("BackgroundColor").setValue("LightGrey");
  }

  tree.draw = function (context) {
    // clear Everything
    HTMLCanvas.width = this.getProperty("Width").getValue();
    HTMLCanvas.height = this.getProperty("Height").getValue();
    context.clearRect(0, 0,context.canvas.width, context.canvas.height);
    // Uses the generic draw function to draw the root element of the tree
    genericDraw.call(this, context);
  }

  tree.draw(context);
  return tree;
}

function createHTMLCanvas(selector) {
  // should only be created if not already there
  if(!HTMLCanvas) {
    HTMLCanvas = document.createElement('canvas');
    context = HTMLCanvas.getContext("2d");
  
    selector.appendChild(HTMLCanvas);
  }
}

/*function init (config) {
  createHTMLCanvas(config.selector);
  setupBuiltInValidators();
  setupBuiltInComponents();

  baseProperties = {
    Top   : createProperty('Top',    {initialValue:10,      validator:getValidator('integer')}),
    Left  : createProperty('Left',   {initialValue:10,      validator:getValidator('integer')}),
    Width : createProperty('Width',  {initialValue:100,     validator:getValidator('integer')}),
    Height: createProperty('Height', {initialValue:50,      validator:getValidator('integer')}),
    Color: createProperty('Color',   {initialValue:'Black', validator:getValidator('color')}),
    BackgroundColor: createProperty('BackgroundColor', {initialValue:'White', validator:getValidator('color')})
  };



  window.onresize = function () {
  }
}*/
setupBuiltInValidators();
setupBuiltInComponents();

baseProperties = {
  Top   : createProperty('Top',    {initialValue:10,      validator:getValidator('integer')}),
  Left  : createProperty('Left',   {initialValue:10,      validator:getValidator('integer')}),
  Width : createProperty('Width',  {initialValue:100,     validator:getValidator('integer')}),
  Height: createProperty('Height', {initialValue:50,      validator:getValidator('integer')}),
  Color: createProperty('Color',   {initialValue:'Black', validator:getValidator('color')}),
  BackgroundColor: createProperty('BackgroundColor', {initialValue:'White', validator:getValidator('color')})
};


export default {
  registerComponent: registerComponent,
  createComponent: createComponent,
  getComponentType: getComponentType,
  getPropertyForComponentType: getPropertyForComponentType,
  inspect: inspect,
  registerValidator: registerValidator,
  getValidator: getValidator,
  createHTMLCanvas: createHTMLCanvas,
  getTree: getTree,
  debug: {
    getTypes: function() {
      return types;
    },
    getTree: function () {return tree;}
  }

}
