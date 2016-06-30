import events from './events';

export default {
  'Base': {
    abstract: true,
    children: [],
    properties: {
      Top:    { initialValue: 10,  validator: 'integer'},
      Bottom: { initialValue: 0,   validator: 'integer'},
      Left:   { initialValue: 10,  validator: 'integer'},
      Width:  { initialValue: 100, validator: 'integer'},
      Height: { initialValue: 50,  validator: 'integer'},
      Color:  { initialValue: 'Black', validator: 'color'},
      BackgroundColor: { initialValue: 'White', validator: 'color'},
      Border: { initialValue: 1,   validator: 'integer'},
      ZIndex: { initialValue: 0, validator: 'integer'},
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
      const property = this.getProperty(name);
      let reflow = false;
      if(this.parent) reflow = true;
      property.setValue(value, reflow);
      return property;
    },
    resetProperty: function (name) {
      var property = this.getProperty(name);
      property.resetValue();
    },
    appendChild: function (Component) {
      Component.parent=this;
      this.children.push(Component);
      //reflow(context);
    },
  },
  'SimpleBox': {
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
        context.strokeStyle = color;
        context.lineWidth   = border;
        context.strokeRect(l, t, w, h);
      }
      context.closePath();
    }
  },
  'Canvas': {
    extends: 'SimpleBox',
    abstract: true,
    draw: function(context, HTMLCanvas) {
      var prototype = Object.getPrototypeOf(this);
      // clear Everything
      HTMLCanvas.width = this.getProperty("Width").getValue();
      HTMLCanvas.height = this.getProperty("Height").getValue();
      context.clearRect(0,0,context.canvas.width,context.canvas.height);
      prototype.draw(context);
    }
  },
  'TextBox': {
    extends: 'SimpleBox',
    properties:{
      Text:          {initialValue:'No Text', validator: 'string'}, 
      TextAlignment: {initialValue:'left', validator: 'textAlignment'},
      FontSize:      {initialValue:14, validator: 'integer'},
      FontFamily:    {initialValue:'Arial', validator: 'string'}
    },
    draw: function(context) {
      const prototype = Object.getPrototypeOf(this);

      let posX = this.getProperty("Left").getValue();
      const posY = (this.getProperty("Top").getValue() 
                 + this.getProperty("Height").getValue() / 2) 
                 + (this.getProperty("FontSize").getValue() / 2.5);
      const font = this.getProperty("FontSize").getValue() 
                 + "px " 
                 + this.getProperty("FontFamily").getValue();
      const text = this.getProperty("Text").getValue();
      const align = this.getProperty("TextAlignment").getValue().toUpperCase();
      const textWidth = context.measureText(text).width;

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
    measureText: function (context) {
      const text = this.getProperty("Text").getValue();
      return context.measureText(text).width;
    }
  },
  'NavBtn': {
    extends: 'TextBox',
    properties: {
      GoTo: {initialValue:'#', validator: 'string'}
    },
    click: function ( e ) {
      var left   = this.getProperty("Left").getValue();
      var top    = this.getProperty("Top").getValue();
      var width  = this.getProperty("Width").getValue();
      var height = this.getProperty("Height").getValue();
      var hit = e.mouseX >= left && e.mouseX  <= left + width 
             && e.mouseY >= top  && e.mouseY  <= top + height;
      if(hit) {
        var link = this.getProperty('GoTo').getValue();
        events.publish("GOTO", link);
      }
    }
  }
}
