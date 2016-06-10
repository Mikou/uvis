let selector   = undefined;
let HTMLCanvas = null;
let context    = undefined;
const types = {};
const validators = {};
let tree = undefined;
let baseProperties = null;

function reflow (context) {

  const h = {};

  traverseTree(tree, function(Component) {
    const zindex = Component.getProperty("ZIndex").getValue();
    const keysSorted = Object.keys(h).sort(function(a,b){return h[a]-h[b]});
    if(h.hasOwnProperty(zindex)) {
      h[zindex].push(Component);
    } else {
      const arr = [];
      arr.push(Component);
      h[zindex] = arr;
    }

    for(let z=0, len=keysSorted.length; z<len; z++) {
      const Components = h[keysSorted[z]];
      for(let i=0, len=Components.length; i<len; i++) {
        Components[i].draw(context);
      }
    }

    //Component.draw(context);
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

  // the name must be different from the name of the type to extend;
  if(typeParams.extends === name)
    throw new Error("The Type name ('" + name + "') cannot be the same as the Type to extend");

  // implicitely sets abstract to false if not defined;
  if(!typeParams.abstract)
    typeParams.abstract = false;

  // the provided initialValues should pass their given validator;
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
function createComponent (type, internal) {

  const T = getType(type);

  if(!internal && T.abstract)
    throw new Error('The requested type is abstract and can therefore not be instanciated');

  const prototype = (T.extends) ? createComponent(T.extends, true) : Object.prototype;
  const component = Object.create(prototype, {
    children:   { writable:true, value: [] },
    properties: { writable:true, value: {} }
  });
 
  for(let prop in T.properties) {
    component.properties[prop] = createProperty(prop, T.properties[prop]);
  }
  for(let key in T) {
    if(key === 'properties' || key === 'extends') continue;
    component[key] = T[key];
  }

  return component;
}

function getComponentType (type) {
  if(types.hasOwnProperty(type))
    return types[type];
  return undefined;
}

function inspect (internal, type, property) {
  const T = types[type];

  if(typeof T === 'undefined' || !property)
    return T;

  if(!internal && T.abstract)
    throw new Error("Abstract type " + type);

  const properties = T.properties;
  if(properties && properties.hasOwnProperty(property)) {
    return properties[property];
  } else if(T.extends) {
    return inspect(true, T.extends, property);
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
    if(typeof input === 'number')
      input = input.toString();
    if(typeof input !== 'string')
      throw new Error("the provided input cannot be recognized as a 'string' for property '" + propertyName + "'.");
  });
  registerValidator('textAlignment', function (input, propertyName) {
    var strValidator = getValidator('string');
    strValidator(input);
    input = input.toUpperCase();
    if((input === 'CENTER') || (input === 'LEFT') || (input === 'RIGHT')) return;
      
    throw new Error("the provided input '"+input+"' for property '" + propertyName + "' must be one of 'center', 'left' or 'right'.");
  });
  registerValidator('color', function (input, propertyName) {
    var CSS_COLOR_NAMES = ["AliceBlue","AntiqueWhite","Aqua","Aquamarine","Azure","Beige","Bisque","Black","BlanchedAlmond","Blue","BlueViolet","Brown","BurlyWood","CadetBlue","Chartreuse","Chocolate","Coral","CornflowerBlue","Cornsilk","Crimson","Cyan","DarkBlue","DarkCyan","DarkGoldenRod","DarkGray","DarkGrey","DarkGreen","DarkKhaki","DarkMagenta","DarkOliveGreen","Darkorange","DarkOrchid","DarkRed","DarkSalmon","DarkSeaGreen","DarkSlateBlue","DarkSlateGray","DarkSlateGrey","DarkTurquoise","DarkViolet","DeepPink","DeepSkyBlue","DimGray","DimGrey","DodgerBlue","FireBrick","FloralWhite","ForestGreen","Fuchsia","Gainsboro","GhostWhite","Gold","GoldenRod","Gray","Grey","Green","GreenYellow","HoneyDew","HotPink","IndianRed","Indigo","Ivory","Khaki","Lavender","LavenderBlush","LawnGreen","LemonChiffon","LightBlue","LightCoral","LightCyan","LightGoldenRodYellow","LightGray","LightGrey","LightGreen","LightPink","LightSalmon","LightSeaGreen","LightSkyBlue","LightSlateGray","LightSlateGrey","LightSteelBlue","LightYellow","Lime","LimeGreen","Linen","Magenta","Maroon","MediumAquaMarine","MediumBlue","MediumOrchid","MediumPurple","MediumSeaGreen","MediumSlateBlue","MediumSpringGreen","MediumTurquoise","MediumVioletRed","MidnightBlue","MintCream","MistyRose","Moccasin","NavajoWhite","Navy","OldLace","Olive","OliveDrab","Orange","OrangeRed","Orchid","PaleGoldenRod","PaleGreen","PaleTurquoise","PaleVioletRed","PapayaWhip","PeachPuff","Peru","Pink","Plum","PowderBlue","Purple","Red","RosyBrown","RoyalBlue","SaddleBrown","Salmon","SandyBrown","SeaGreen","SeaShell","Sienna","Silver","SkyBlue","SlateBlue","SlateGray","SlateGrey","Snow","SpringGreen","SteelBlue","Tan","Teal","Thistle","Tomato","Turquoise","Violet","Wheat","White","WhiteSmoke","Yellow","YellowGreen"];

    var strValidator = getValidator('string');
    strValidator(input);

    // regex matching #abc and #abcdef
    if(/^#([0-9a-f]{3}){1,2}$/i.test(input)) return;

    for(var color in CSS_COLOR_NAMES)
      if(input.toUpperCase() === CSS_COLOR_NAMES[color].toUpperCase())
        return;

    throw new Error("the provided input '"+input+"' for property '" + propertyName + "' cannot be recognized as a valid 'color'.");


  });
}

function setupBuiltInComponents () {

  registerComponent('Base', {
    abstract: true,
    children: [],
    properties: {
      Top:    { initialValue: 10,  validator: getValidator('integer')},
      Bottom: { initialValue: 0,   validator: getValidator('integer')},
      Left:   { initialValue: 10,  validator: getValidator('integer')},
      Width:  { initialValue: 100, validator: getValidator('integer')},
      Height: { initialValue: 50,  validator: getValidator('integer')},
      Color:  { initialValue: 'Black', validator: getValidator('color')},
      BackgroundColor: { initialValue: 'White', validator: getValidator('color')},
      Border: { initialValue: 1,   validator: getValidator('integer')},
      ZIndex: { initialValue: 0, validator: getValidator('integer')},
    },
    getProperty: function (name) {
      // (1) lookup in the local properties
      for(var prop in this.properties)
        if(name === prop) return this.properties[prop];
      // (2) otherwise lookup in the prototype's properties
      const prototype = Object.getPrototypeOf(this);
      if(prototype.hasOwnProperty('properties'))
        return this.getProperty.call(prototype, name);
      // (3) The property was not found
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

  });

  registerComponent('SimpleBox', {
    extends: 'Base',
    abstract: false,
    draw: function(context) {
      const border = this.getProperty("Border").getValue();
      const color = this.getProperty("Color").getValue();
      const bgCol = this.getProperty("BackgroundColor").getValue();
      const l = this.getProperty("Left").getValue();
      const t = this.getProperty("Top").getValue();
      const w = this.getProperty("Width").getValue();
      const h = this.getProperty("Height").getValue();

      context.beginPath();
      context.fillStyle = bgCol;
      context.fillRect(l, t, w, h);
      context.fill();

      if(border) {
        if(border !== 1)
          console.log(border);
        context.strokeStyle = color;
        context.lineWidth   = border;
        context.strokeRect(l, t, w, h);
      }
      context.closePath();
    }
  });

  registerComponent('Canvas', {
    extends: 'SimpleBox',
    abstract: true,
    draw: function(context) {
      var prototype = Object.getPrototypeOf(this);
      // clear Everything
      HTMLCanvas.width = this.getProperty("Width").getValue();
      HTMLCanvas.height = this.getProperty("Height").getValue();
      context.clearRect(0,0,context.canvas.width, context.canvas.height);
      prototype.draw(context);
    }
  });

  registerComponent('TextBox', {
    extends: 'SimpleBox',
    properties:{
      Text:          {initialValue:'No Text', validator: getValidator('string')}, 
      TextAlignment: {initialValue:'left', validator: getValidator('textAlignment')},
      FontSize:      {initialValue:14, validator: getValidator('integer')},
      FontFamily:    {initialValue:'Arial', validator: getValidator('string')}
    },
    draw: function(context) {
      var prototype = Object.getPrototypeOf(this);

      var posX = this.getProperty("Left").getValue();
      var posY = (this.getProperty("Top").getValue() 
               + this.getProperty("Height").getValue() / 2) 
               + (this.getProperty("FontSize").getValue() / 2.5);
      var font = this.getProperty("FontSize").getValue() 
               + "px " 
               + this.getProperty("FontFamily").getValue();
      var text = this.getProperty("Text").getValue();
      var align = this.getProperty("TextAlignment").getValue().toUpperCase();
      var textWidth = context.measureText(text).width;

      if(align === 'RIGHT') {
        posX = this.getProperty("Left").getValue() 
             + this.getProperty("Width").getValue() - textWidth - 10;
      } else if(align === 'CENTER') {
        posX = this.getProperty("Left").getValue() 
             + this.getProperty("Width").getValue() / 2 - (textWidth / 2);
      } else {
        posX = posX + 10;
      }

      // draw the box
      prototype.draw(context);

      context.font=font;
      context.textAlign = align;
      context.fillStyle = this.getProperty("Color").getValue();
      context.fillText(text ,posX ,posY);
    },
    mousemove: function (e) {
      var left   = this.getProperty("Left").getValue();
      var top    = this.getProperty("Top").getValue();
      var width  = this.getProperty("Width").getValue();
      var height = this.getProperty("Height").getValue();
      var over   = e.mouseX >= left && e.mouseX  <= left + width 
                && e.mouseY >= top  && e.mouseY  <= top + height;

      if(over) {
        this.setProperty("BackgroundColor", "red");
      }
    }
  })
}

function getTree () {

  if(typeof tree === 'undefined') {
    tree = createComponent('Canvas', true);

    tree.getProperty("Top").setValue(0);
    tree.getProperty("Left").setValue(0);
    tree.getProperty("Width").setValue(640);
    tree.getProperty("Height").setValue(480);
    tree.getProperty("BackgroundColor").setValue("LightGrey");
  }

  tree.draw(context, HTMLCanvas);
  return tree;
}

function createHTMLCanvas(selector) {
  // should only be created if not already there
  if(!HTMLCanvas) {
    HTMLCanvas = document.createElement('canvas');
    context = HTMLCanvas.getContext("2d");

    function getMousePos(canvas, evt) {
      var rect = canvas.getBoundingClientRect();
      return {
        mouseX: evt.clientX - rect.left,
        mouseY: evt.clientY - rect.top
      };
    }

    HTMLCanvas.addEventListener('mousemove', function (e) {
      traverseTree(tree, function (component) {
        if(typeof component.mousemove === 'function') {
          component.mousemove(getMousePos(HTMLCanvas, e));
        }
      });
    });

    selector.appendChild(HTMLCanvas);
  }
}

setupBuiltInValidators();
setupBuiltInComponents();

function reset () {
  tree.children = [];
}

export default {
  reset: reset,
  registerComponent: registerComponent,
  createComponent: createComponent,
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
