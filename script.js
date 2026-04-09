/* Minimal client-only logic for the AI Website Builder UI.
   - Saves OpenAI key to localStorage (never send to server here)
   - Sends user prompt to OpenAI and extracts an HTML single-file response
   - Preview sets iframe.srcdoc, copy button copies code, clear resets
*/

const apiKeyInput = document.getElementById('apiKey');
const saveKeyBtn = document.getElementById('saveKey');
const chat = document.getElementById('chat');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');

const codeArea = document.getElementById('code');
const preview = document.getElementById('preview');

const generateBtn = document.getElementById('generateBtn');
const runBtn = document.getElementById('runBtn');
const copyBtn = document.getElementById('copyBtn');
const clearBtn = document.getElementById('clearBtn');

const STORAGE_KEY = 'AWB_OPENAI_KEY';

function loadKey(){
  const k = localStorage.getItem(STORAGE_KEY) || '';
  apiKeyInput.value = k;
}
function saveKey(){
  const k = apiKeyInput.value.trim();
  if(!k){ alert('Enter an OpenAI API key first (it will be stored only in your browser).'); return; }
  localStorage.setItem(STORAGE_KEY, k);
  alert('API key saved locally.');
}
saveKeyBtn.addEventListener('click', saveKey);
loadKey();

/* Messaging UI helpers */
function addMessage(role, text){
  const el = document.createElement('div');
  el.className = 'message ' + (role === 'user' ? 'user' : 'ai');
  el.textContent = text;
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
  return el;
}

function setLoadingMessage(text){
  const el = document.createElement('div');
  el.className = 'message ai';
  el.textContent = text;
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
  return el;
}

/* Extract first HTML code block (```html ... ```). If none found, return entire text. */
function extractHtmlFromResponse(text){
  const codeBlock = text.match(/```(?:html)?\n([\s\S]*?)```/i);
  if(codeBlock && codeBlock[1]) return codeBlock[1].trim();
  // fallback: if content looks like starts with <, return it
  const maybeHtml = text.trim();
  if(maybeHtml.startsWith('<')) return maybeHtml;
  return text; // last resort
}

/* Send prompt to OpenAI (Chat Completions). The code expects the user to ask for a single-file website.
   This is a simple client-side fetch. It will fail if the user's key is invalid or CORS is blocked.
*/
async function sendToOpenAI(prompt){
  const key = localStorage.getItem(STORAGE_KEY) || apiKeyInput.value.trim();
  if(!key){
    alert('Please provide and save your OpenAI API key first.');
    return null;
  }

  // system instruction nudges the model to return only a single HTML document enclosed in a code block
  const systemMsg = `You are an assistant that returns exactly one complete HTML document (with inline CSS and JS if needed) inside a single code block. Do not add explanations, metadata, or extra text. Only return the HTML file content inside a code block (e.g. \`\`\`html ... \`\`\`). Keep it clean and minimal, suitable for immediate preview in an iframe.`;

  const body = {
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: systemMsg },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,
    max_tokens: 2500
  };

  try{
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify(body)
    });
    if(!res.ok){
      const errText = await res.text();
      throw new Error(`OpenAI error ${res.status}: ${errText}`);
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    return content;
  }catch(err){
    console.error(err);
    alert('Error from OpenAI: ' + err.message);
    return null;
  }
}

/* Chat submit */
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if(!text) return;
  addMessage('user', text);
  userInput.value = '';
  const loadingEl = setLoadingMessage('Generating — this may take a few seconds...');
  const aiRaw = await sendToOpenAI(text);
  if(!aiRaw){
    loadingEl.textContent = 'Error: failed to generate.';
    return;
  }
  loadingEl.remove();
  // show AI message (short)
  addMessage('ai', 'Generated website (code placed on the right).');
  const html = extractHtmlFromResponse(aiRaw);
  codeArea.value = html;
  // auto-preview
  preview.srcdoc = html;
});

/* Toolbar actions */
generateBtn.addEventListener('click', async () => {
  // if there is text in the input form, use it; otherwise ask the AI to generate from a short prompt based on the last user message
  const prompt = userInput.value.trim() || 'Create a single-file HTML landing page for a coffee shop with hero, features section, contact; minimal, responsive, light palette.';
  userInput.value = prompt;
  // reuse chat submit handler
  chatForm.requestSubmit();
});

runBtn.addEventListener('click', () => {
  preview.srcdoc = codeArea.value || '<!doctype html><html><body><p>No code to preview.</p></body></html>';
});

copyBtn.addEventListener('click', async () => {
  try{
    await navigator.clipboard.writeText(codeArea.value);
    copyBtn.textContent = 'Copied!';
    setTimeout(()=> copyBtn.textContent = 'Copy Code', 1400);
  }catch(e){
    alert('Copy failed: ' + e.message);
  }
});

clearBtn.addEventListener('click', () => {
  if(!confirm('Clear generated code and preview?')) return;
  codeArea.value = '';
  preview.srcdoc = '';
});

/* small UX niceties */
userInput.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)){
    chatForm.requestSubmit();
  }
});

// initial placeholder preview
preview.srcdoc = '<!doctype html><html><body style=\"font-family:system-ui, -apple-system, Roboto, Arial;display:flex;align-items:center;justify-content:center;height:100%;color:#334155\"><div style=\"text-align:center\"><h3>Preview</h3><p>Generate a website on the left and it will appear here.</p></div></body></html>';