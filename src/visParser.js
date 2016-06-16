let ts = undefined;
let canvas = undefined;
let form = undefined;
let tplCount =0;
var current = null;


const PRECEDENCE = {
  "WHERE": 1,
  "=": 2, ":": 2, "&": 2,
  "-<": 3, ">-": 3,
  "<": 7, ">": 7, "<=": 7, ">=": 7, "==": 7, "!=": 7,
  "+": 10, "-": 10,
  "*": 20, "/": 20, "%": 20,
};

function isOp(op) {
  var tok = ts.peek();
  return tok && tok.type == "op" && (!op || tok.value == op) && tok;
}

function isEOL(ch) {
  var tok = ts.peek();
  return tok && tok.type == 'EOL' && (!ch || tok.value == ch) && tok;
}

function isPunc(ch) {
  var tok = ts.peek();
  return tok && tok.type == "punc" && (!ch || tok.value == ch) && tok;
}
function skipSeparator() {
  var tok = ts.peek();
  if (tok.type == "separator") ts.next();
  else ts.croak("Expecting a Template Separator : ");
}
function skipEOL() {
  var tok = ts.peek();
  if (tok.type === "EOL") ts.next();
  else ts.croak("Expecting EOL");
}
function skip_punc(ch) {
  if (isPunc(ch)) ts.next();
  else ts.croak("Expecting punctuation: \"" + ch + "\"");
}

function parsePath(expr) {
  var tok = ts.peek();
  var path = {
    type: 'path',
    content: expr
  };
  if(expr.type == 'id') {
    if(isPunc("[")) {
      path.index = delimited("[", "]", parseAtom);
    }
    if(isPunc(".") || isPunc("!")) path.next = parsePath(ts.next());
  } else if(expr.type == 'punc') {
    if(tok.type=='id') path.next = parsePath(ts.next());
  }
  
  return path;

  //throw new Error("Not yet implemented");
}

function maybePath(expr) {
  return (isPunc(".") || isPunc("!")) ? parsePath(expr) : expr;
}

// extends an expression as much as possible to the right
function maybe_binary(left, my_prec) {
  var tok = isOp();
  if (tok) {
    var his_prec = PRECEDENCE[tok.value];
    if (his_prec > my_prec) {
      ts.next();
      var right = maybe_binary(maybePath(parseAtom()), his_prec);

      return maybe_binary({
        type     : "binary",
        operator : tok.value,
        left     : left,
        right    : right//maybe_binary(parseAtom(), his_prec)
      }, my_prec);
    }
  }
  return left;
}

function delimited(start, stop, parser) {
  skip_punc(start);
  var a = parser();
  skip_punc(stop);
  return a;
}

function parseAtom() {
  var tok = ts.next();

  if (tok.type === "id"   ||
      tok.type === "datetime"  ||
      tok.type === "key"  ||
      tok.type === "path" ||
      tok.type === "num"  || 
      tok.type === "str")
    return tok;

  ts.croak("Unexpected token " + JSON.stringify(ts.peek()));

}

function skipSeparator() {
  var tok = ts.peek();
  if (tok.type == "separator") ts.next();
  else ts.croak("Expecting a Template Separator : ");
}

function skipEOL() {
  var tok = ts.peek();
  if (tok.type === "EOL") ts.next();
  else ts.croak("Expecting EOL");
}

function parseFormula () {
  while(!ts.eof() && ts.peek().type !== 'EOL' ){
    return {type:'formula', value: maybe_binary(maybePath(parseAtom()), 0)};
  }
}

function parseProperty () {
  var key = ts.next();
            if(!isOp(":")) throw new Error("semicolon expected");
            ts.next(); // skip semicolon
  var formula = parseFormula();
  return {key: key.value, formula: formula};
}

// Default form header
const DEFAULT_FORM_HEADER = {
  Name  : 'fileName.vis',
  Width : {'type': 'formula', value: {type:'num', value: '360'}},
  Height: {'type': 'formula', value: {type:'num', value: '400'}}
};

// Assuming header keys are constants
const HEADER_KEYS = ['Name', 'Width', 'Height'];

function isHeaderKey (name) {
  for(var k in HEADER_KEYS)
    if(k===name) return true;
  return false;
}

function parseTemplate () {
  const properties = [];
  const tplDefinition = {};
  const template = form.createTemplate();

  while(!ts.eof() && ts.peek().type !== 'separator') {
    const property = parseProperty();
    tplDefinition[property.key] = property.formula;
    if(!ts.eof()) skipEOL();
  }
  if(!ts.eof() && ts.peek().type === 'separator') skipSeparator();


  // Try to determinate the component type
  for(var key in tplDefinition)
    if (typeof canvas.inspect(false, key) !== 'undefined')
      template.componentType = key;
      //template.setComponentType(key);


  // when we look at the first template
  if(++tplCount === 1) {
    // is it a form header ? (No component type is addressed)
    if(template.componentType === null) {

      template.componentType = 'CANVAS';
      template.name = (tplDefinition.hasOwnProperty('Name')) ? tplDefinition.Name : DEFAULT_FORM_HEADER.Name;
      template.setProperty("Width",  tplDefinition.hasOwnProperty("Width")  ? tplDefinition.Width  : DEFAULT_FORM_HEADER.Width);
      template.setProperty("Height", tplDefinition.hasOwnProperty("Height") ? tplDefinition.Height : DEFAULT_FORM_HEADER.Height);

      form.setTree(template);

      return;
    } else {

      var rootTpl = form.createTemplate();
      rootTpl.componentType = 'CANVAS';
      rootTpl.name = DEFAULT_FORM_HEADER.Name;
      rootTpl.setProperty("Width", DEFAULT_FORM_HEADER.Width);
      rootTpl.setProperty("Height", DEFAULT_FORM_HEADER.Height);

      form.setTree(rootTpl);

      buildTemplate(tplDefinition);
      return;
    }

  } else {
    if(template.componentType === null)
      throw new Error("The Template number " +tplCount+ " does not define a valid Component Type");

    buildTemplate(tplDefinition);
    return;
  }

  function buildTemplate(tplDefinition) {
    // when the component type is known, we can check the keys against the component type
    for(var key in tplDefinition) {
      //if(canvas.getPropertyForComponentType(key, template.componentType)) {
      if(canvas.inspect(false, template.componentType, key)) {
        template.setFormulaForProperty(key, tplDefinition[key]);
      } else {
        if(key === template.componentType) {
          template.name = tplDefinition[key].value.value;
        }
        else if(key === 'Rows') {
          //template.setRows(tplDefinition[key]);
          template.rows = tplDefinition[key];
        } else {
          throw new Error("'" + key + "' is not a valid property name for Component of type " + template.componentType);
        }
      }
    }
    form.addTemplate(template);
  }
}

function parseVisformTemplate () {
  while(!ts.eof()) {
    parseTemplate();
  }
  return form;
}

function init (config) {
  tplCount = 0;
  ts     = config.tokenizer;
  canvas = config.canvas;
  form   = config.form;
};

module.exports = {
  init: init,
  parse: parseVisformTemplate
};

