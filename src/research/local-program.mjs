import { createHash } from 'node:crypto';

export const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const fail = reason => { throw new Error(`LOCAL_PROGRAM_${reason}`); };
const OPERATORS = Object.freeze({add:(a,b)=>a+b,subtract:(a,b)=>a-b,multiply:(a,b)=>a*b,divide:(a,b)=>{if(b===0)fail('DIVIDE_BY_ZERO');return a/b;},min:Math.min,max:Math.max});
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length===keys.length && keys.every(k=>Object.hasOwn(value,k));

// A finite, data-only straight-line program. Never eval model-supplied code.
// Dependencies certify the executed expression, not semantic relevance to a question.
export function evaluateLocalProgram(program, facts, allowedFields, {maxSteps=8}={}) {
  if(!Array.isArray(program)||program.length<1||program.length>maxSteps)fail('SIZE');
  const permitted = new Set(allowedFields), values=[], dependencies=new Map();
  const operand = (arg, index) => {
    if(exact(arg,['field'])) {
      if(typeof arg.field!=='string'||!permitted.has(arg.field)||!Object.hasOwn(facts,arg.field)||!Number.isFinite(facts[arg.field]))fail('FIELD');
      dependencies.set(arg.field,hash(facts[arg.field]));return facts[arg.field];
    }
    if(exact(arg,['constant'])) {
      if(!Number.isFinite(arg.constant)||Math.abs(arg.constant)>1e9)fail('CONSTANT');return arg.constant;
    }
    if(exact(arg,['step'])) {
      if(!Number.isInteger(arg.step)||arg.step<0||arg.step>=index)fail('BACK_REFERENCE');return values[arg.step];
    }
    fail('OPERAND');
  };
  const usedSteps = new Set();
  for(let i=0;i<program.length;i++) {
    const expression=program[i];
    if(!exact(expression,['op','args'])||!Object.hasOwn(OPERATORS,expression.op)||!Array.isArray(expression.args)||expression.args.length!==2)fail('EXPRESSION');
    const args=expression.args.map(a=>operand(a,i)),value=OPERATORS[expression.op](...args);
    if(!Number.isFinite(value)||Math.abs(value)>1e18)fail('RESULT');values.push(value);
  }
  // Reject unused intermediate work: it must not authorize unrelated reads.
  const visit=i=>{if(usedSteps.has(i))return;usedSteps.add(i);for(const a of program[i].args)if(Object.hasOwn(a,'step'))visit(a.step);};
  visit(program.length-1);if(usedSteps.size!==program.length)fail('DEAD_CODE');
  if(!dependencies.size)fail('NO_SOURCE');
  return {value:values.at(-1),program:structuredClone(program),programSha256:hash(program),
    dependencies:[...dependencies].map(([field,sha256])=>({field,sha256})),intermediates:values};
}

// Result release is separately authorized. Computing an allowed field does not
// itself authorize disclosing that field, or an arbitrary function of it.
export function bindDerivedResult({program,facts,allowedFields,runId,stepId,recipient,policy,purpose}) {
  if(!policy.allowed||!policy.allowDerived||!purpose||recipient!=='cloud-model')fail('RELEASE_POLICY');
  const evaluated=evaluateLocalProgram(program,facts,allowedFields);
  const sealed=structuredClone({...evaluated,runId,stepId,recipient,purpose,policyVersion:policy.version});
  let used=false;
  return {
    audit:structuredClone(sealed),
    consume({runId:currentRun,stepId:currentStep,recipient:currentRecipient,policy:currentPolicy,purpose:currentPurpose}) {
      if(used)fail('REPLAY');
      if(currentRun!==sealed.runId||currentStep!==sealed.stepId||currentRecipient!==sealed.recipient||currentPurpose!==sealed.purpose)fail('BINDING');
      if(!currentPolicy.allowed||!currentPolicy.allowDerived||currentPolicy.version!==sealed.policyVersion)fail('POLICY_CHANGED');
      for(const d of sealed.dependencies)if(!Object.hasOwn(facts,d.field)||hash(facts[d.field])!==d.sha256)fail('SOURCE_CHANGED');
      used=true;
      return {value:sealed.value,programSha256:sealed.programSha256};
    }
  };
}

export const PROGRAM_SCHEMA={type:'array',minItems:1,maxItems:8,items:{type:'object',properties:{
  op:{type:'string',enum:Object.keys(OPERATORS)},args:{type:'array',minItems:2,maxItems:2,items:{type:'object',properties:{field:{type:'string'},constant:{type:'number'},step:{type:'integer',minimum:0}},additionalProperties:false}}
},required:['op','args'],additionalProperties:false}};
