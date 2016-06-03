let ts;
let current = null;
let map = null;
let isTable = false;

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

function isPunc(ch) {
  var tok = ts.peek();
  return tok && tok.type == "punc" && (!ch || tok.value == ch) && tok;
}

function skip_separator() {
  var tok = ts.peek();
  if (tok.type == "separator") ts.next();
  else ts.croak("Expecting a Template Separator : ");
}

function skip_EOL() {
  var tok = ts.peek();
  if (tok.type === "EOL") ts.next();
  else ts.croak("Expecting EOL");
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

}

function maybeList(expr) {
  if(isPunc(",") || isPunc(";")) {
    var list = {type:'list', value: []};
    
    while(isPunc(",") || isPunc(";") || ts.eof()) {
      list.value.push(expr);
      ts.next(); // skip ","
      expr = maybeBinary(maybePath(parseAtom()), 0);
    }

    list.value.push(expr);  
    return list;
  } else {
    return expr;
  }
}

function parsePath(expr) {
  var tok = ts.peek();
  var path = {
    type: 'path',
    content: expr
  };
  if(expr.type == 'id') {
    if(isPunc(".") || isPunc("!")) path.next = parsePath(ts.next());
  } else if(expr.type == 'punc') {
    if(tok.type=='id') path.next = parsePath(ts.next());
  }
  
  return path;
}


function maybePath(expr) {
  return (isPunc(".") || isPunc("!")) ? parsePath(expr) : expr;
}

function maybeBinary(left, my_prec) {
  var tok = isOp();
  if (tok) {
    var his_prec = PRECEDENCE[tok.value];
    if (his_prec > my_prec) {
      ts.next();
      var right = maybeBinary(maybePath(parseAtom()), his_prec);

      return maybeBinary({
        type     : "binary",
        operator : tok.value,
        left     : left,
        right    : right
      }, my_prec);
    }
  }
  return left;
}

function parseTableFormula () {

  const on = {from:null, to: null};
  const cardinality = ts.next().value;
  if(!isPunc(",")) throw new Error("Comma Expected");
  ts.next() // skip comma;
  if(ts.next().value !== 'join') throw new Error("join expected");
  if(ts.peek().type !== 'id') throw new Error("identifier expected");
  const join = ts.next().value;
  if(ts.next().value !== 'on') throw new Error("on expected");
  
  const from = parsePath(ts.next());
  on.from = {
    table: from.content.value,
    fields: [from.next.next.content.value]
  };
  if(ts.next().value !== '=') throw new Error("equal sign expected");
  const to = parsePath(ts.next());
  on.to = {
    table: to.content.value,
    fields: [to.next.next.content.value]
  };
  
  return {
    type: 'relationDef',
    cardinality: cardinality,
    join: join,
    on: on
  }
  
}

function parseTableProperty () {
  const key = ts.next();
              if(!isOp(":")) throw new Error("semicolon expected");
              ts.next();
 
  const exp = parseTableFormula();
  return {key: key.value, value:exp}; 
}

function parseFormula () {
  while(!ts.eof() && ts.peek().type !== 'EOL') {
    return {type:'formula', value: maybeList(maybeBinary(maybePath(parseAtom()), 0))};
  }
}

function parseProperty () {
  var key = ts.next();
            if(!isOp(":")) throw new Error("semicolon expected");
            ts.next(); // jump over semicolon op;
  
  var exp = parseFormula();
  return {key: key.value, value: exp};
}


function parseTemplate () {
  let template = {};
  while( !ts.eof() && ts.peek().type !== 'separator' ) {
    while( ts.peek().type === 'EOL' ) skip_EOL();
    let property = parseProperty(); skip_EOL();
    if(property.key === 'Table') {
      var table = {
        name: property.value.value.value,
        relations: {}
      };
      isTable = true;
      while( isTable ) {
        const tableProperty = parseTableProperty(); skip_EOL()
        table.relations[tableProperty.key] = tableProperty.value;
        if(ts.eof() || ts.peek().type === 'separator') {
          isTable = false;
          if(!ts.eof()) skip_separator();
          return table;
        }
      }
    } else {
      template[property.key] = property.value;
    }
  }

  if(ts.peek() && ts.peek().type === 'separator') skip_separator();
  return template;
}  

function readNext() {
  if(ts.eof()) return null;

  return parseTemplate();
}

function eof () {
  return peek() === null;
}

function parse() {
  const visMap = {};
  const headerTemplate = parseTemplate();
  map.setStartUpFormName(headerTemplate.StartUpForm.value.value);
  const dbTemplate = parseTemplate();

  const dbProvider = dbTemplate.Database.value.value[0].right.value;
  const dbSource = dbTemplate.Database.value.value[1].right.value;

  map.setDatabaseProvider(dbProvider);
  map.setDatabaseSource(dbSource);
  
  //map.setDatabaseConnectionString(dbTemplate.Database);
  const schema = {};
  while(!ts.eof()) {
    const table = parseTemplate();
    schema[table.name] = table.relations;
  }
  map.setVismSchema(schema);
}

function init (config) {
  ts  = config.tokenizer;
  map = config.map;
};

export default {
  init:init,
  parse: parse
}
