const fs = require('fs');
const file = 'src/App.tsx';
let c = fs.readFileSync(file, 'utf8');

const sIdx = c.indexOf('function Login({ onCancel');
const eIdx = c.indexOf('export default function App()');

if (sIdx !== -1 && eIdx !== -1) {
    const loginComp = c.substring(sIdx, eIdx);
    fs.writeFileSync('login_comp.tsx', loginComp);
    console.log("Extracted login component");
} else {
    console.log("Indices not found", sIdx, eIdx);
}
