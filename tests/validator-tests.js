const fs=require('fs');
const vm=require('vm');
const code=fs.readFileSync(require('path').join(__dirname,'..','validator.js'),'utf8');
const context={window:{}};
vm.createContext(context);
vm.runInContext(code,context);
const V=context.window.CYBER_VALIDATOR;
let failed=0;
function test(name,actual,expected=true){
  if(actual!==expected){console.error('FAIL',name,'got',actual,'expected',expected);failed++;}
  else console.log('PASS',name);
}
const tcp=['syn syn/ack ack','syn syn-ack ack','syn -> syn/ack -> ack','syn→syn/ack→ack'];
test('TCP exact spaces',V.shortMatches('SYN SYN/ACK ACK',tcp));
test('TCP unicode arrows',V.shortMatches('SYN → SYN/ACK → ACK',tcp));
test('TCP slash omitted in pair',V.shortMatches('syn syn ack ack',tcp));
test('TCP comma separators',V.shortMatches('SYN, SYN-ACK, ACK',tcp));
test('TCP technical typo is NOT auto accepted',V.shortMatches('SYN SYN/ACT ACT',tcp),false);
test('ARP command exact',V.shortMatches('arp -a',['arp -a','arp']));
test('ARP command case',V.shortMatches('ARP -A',['arp -a','arp']));
test('nslookup with target',V.shortMatches('nslookup example.com',['nslookup','nslookup example.com']));
test('tracert with target',V.shortMatches('tracert example.com',['tracert','tracert example.com']));
test('does not accept unrelated word',V.shortMatches('forget',['get']),false);
if(failed){process.exit(1)}
console.log(`\n${10-failed}/10 validator tests passed.`);
