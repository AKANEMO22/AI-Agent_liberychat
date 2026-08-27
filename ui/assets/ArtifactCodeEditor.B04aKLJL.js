import{a as e}from"./rolldown-runtime.Cyuzqnbw.js";import{J as t,K as n}from"./advanced-inputs.BK7W-vXI.js";import{$r as r,Ds as i,Hi as a,Jr as o,Qf as s,Qr as c,Xr as l,Zr as u,ci as d,du as f,fa as p,ii as m,lh as h,mp as g,ni as _,pa as v}from"./hooks.b6UctDqQ.js";import{a as y}from"./utilities.j1uNcxJc.js";import{t as b}from"./code-editor.CtZz1vsD.js";var x=e(t(),1),S=`
/* GitHub Markdown CSS - Light theme base */
.markdown-body {
  -ms-text-size-adjust: 100%;
  -webkit-text-size-adjust: 100%;
  line-height: 1.5;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  word-wrap: break-word;
  color: #24292f;
  background-color: #ffffff;
}

.markdown-body h1, .markdown-body h2 {
  border-bottom: 1px solid #d0d7de;
  margin: 0.6em 0;
}

.markdown-body h1 { font-size: 2em; margin: 0.67em 0; }
.markdown-body h2 { font-size: 1.5em; }
.markdown-body h3 { font-size: 1.25em; }
.markdown-body h4 { font-size: 1em; }
.markdown-body h5 { font-size: 0.875em; }
.markdown-body h6 { font-size: 0.85em; }

.markdown-body ul, .markdown-body ol {
  list-style: revert !important;
  padding-left: 2em !important;
  margin-top: 0;
  margin-bottom: 16px;
}

.markdown-body ul { list-style-type: disc !important; }
.markdown-body ol { list-style-type: decimal !important; }
.markdown-body ul ul { list-style-type: circle !important; }
.markdown-body ul ul ul { list-style-type: square !important; }

.markdown-body li { margin-top: 0.25em; }

.markdown-body li:has(> input[type="checkbox"]) {
  list-style-type: none !important;
}

.markdown-body li > input[type="checkbox"] {
  margin-right: 0.75em;
  margin-left: -1.5em;
  vertical-align: middle;
  pointer-events: none;
  width: 16px;
  height: 16px;
}

.markdown-body .task-list-item {
  list-style-type: none !important;
}

.markdown-body .task-list-item > input[type="checkbox"] {
  margin-right: 0.75em;
  margin-left: -1.5em;
  vertical-align: middle;
  pointer-events: none;
  width: 16px;
  height: 16px;
}

.markdown-body code {
  padding: 0.2em 0.4em;
  margin: 0;
  font-size: 85%;
  border-radius: 6px;
  background-color: rgba(175, 184, 193, 0.2);
  color: #24292f;
  font-family: ui-monospace, monospace;
  white-space: pre-wrap;
}

.markdown-body pre {
  padding: 16px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  border-radius: 6px;
  margin-top: 0;
  margin-bottom: 16px;
  background-color: #f6f8fa;
  color: #24292f;
}

.markdown-body pre code {
  display: inline-block;
  padding: 0;
  margin: 0;
  overflow: visible;
  line-height: inherit;
  word-wrap: normal;
  background-color: transparent;
  border: 0;
}

.markdown-body a {
  text-decoration: none;
  color: #0969da;
}

.markdown-body a:hover {
  text-decoration: underline;
}

.markdown-body table {
  border-spacing: 0;
  border-collapse: collapse;
  display: block;
  width: max-content;
  max-width: 100%;
  overflow: auto;
}

.markdown-body table thead {
  background-color: #f6f8fa;
}

.markdown-body table th, .markdown-body table td {
  padding: 6px 13px;
  border: 1px solid #d0d7de;
}

.markdown-body blockquote {
  padding: 0 1em;
  border-left: 0.25em solid #d0d7de;
  margin: 0 0 16px 0;
  color: #57606a;
}

.markdown-body hr {
  height: 0.25em;
  padding: 0;
  margin: 24px 0;
  border: 0;
  background-color: #d0d7de;
}

.markdown-body img {
  max-width: 100%;
  box-sizing: content-box;
}

/* Dark theme */
@media (prefers-color-scheme: dark) {
  .markdown-body {
    color: #c9d1d9;
    background-color: #0d1117;
  }

  .markdown-body h1, .markdown-body h2 {
    border-bottom-color: #21262d;
  }

  .markdown-body code {
    background-color: rgba(110, 118, 129, 0.4);
    color: #c9d1d9;
  }

  .markdown-body pre {
    background-color: #161b22;
    color: #c9d1d9;
  }

  .markdown-body a {
    color: #58a6ff;
  }

  .markdown-body table thead {
    background-color: #161b22;
  }

  .markdown-body table th, .markdown-body table td {
    border-color: #30363d;
  }

  .markdown-body blockquote {
    border-left-color: #3b434b;
    color: #8b949e;
  }

  .markdown-body hr {
    background-color: #21262d;
  }
}

/* Scrollbar */
::-webkit-scrollbar { height: 0.1em; width: 0.5rem; }
::-webkit-scrollbar-thumb { background-color: rgba(0,0,0,0.1); border-radius: 9999px; }
::-webkit-scrollbar-track { background-color: transparent; border-radius: 9999px; }
@media (prefers-color-scheme: dark) {
  ::-webkit-scrollbar-thumb { background-color: hsla(0,0%,100%,0.1); }
}
* { scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.1) transparent; }
@media (prefers-color-scheme: dark) {
  * { scrollbar-color: hsla(0,0%,100%,0.1) transparent; }
}
`;function C(e){return e.replace(/\\/g,`\\\\`).replace(/`/g,"\\`").replace(/\$/g,`\\$`).replace(/<\/script/gi,`<\\/script`)}var w=`https://cdn.jsdelivr.net/npm/marked@15.0.12/marked.min.js`,T=`sha384-948ahk4ZmxYVYOc+rxN1H2gM1EJ2Duhp7uHtZ4WSLkV4Vtx5MUqnV+l7u9B+jFv+`,E=`const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const isSafeUrl = (url) => {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.startsWith('.')) return true;
  try { return SAFE_PROTOCOLS.has(new URL(trimmed).protocol); } catch(e) { return false; }
};`;function D(e){return`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Markdown Preview</title>
<style>${S}</style>
</head>
<body>
<div class="markdown-body" id="content" style="padding:2rem;margin:1rem;min-height:100vh"></div>
<script src="${w}" integrity="${T}" crossorigin="anonymous"><\/script>
<script>
if (typeof marked === 'undefined') {
  document.getElementById('content').innerHTML =
    '<p style="color:#e53e3e;padding:1rem">Markdown renderer failed to load. Check network connectivity.</p>';
} else {
${E}
marked.use({
  gfm: true,
  breaks: true,
  renderer: {
    html() { return ''; },
    link(token) {
      if (!isSafeUrl(token.href || '')) return '';
      return false; // fall through to marked's default link renderer
    },
    image(token) {
      if (!isSafeUrl(token.href || '')) return '';
      return false; // fall through to marked's default image renderer
    }
  }
});
document.getElementById('content').innerHTML = marked.parse(\`${C(e.replace(/^( {2})(-|\d+\.)/gm,`    $2`))}\`);
}
<\/script>
</body>
</html>`}var O=e=>{let t=e||`# No content provided`;return{"content.md":t,"index.html":D(t)}};function k({artifact:e}){let{theme:t}=(0,x.useContext)(s),n=g(t),[i,a]=(0,x.useMemo)(()=>{let t=u(e.type??``,e.language),r=e.type??``;if(t.includes(`mermaid`))return[`diagram.mmd`,d(e.content??``,n)];if(r===o.CODE){let t=e.language??_(e.title);return[`content.md`,O(m(e.content??``,t))]}if(r===`text/markdown`||r===`text/md`||r===`text/plain`)return[`content.md`,O(e.content??``)];if(r===o.DOCX||r===o.SPREADSHEET||r===o.PRESENTATION)return[`index.html`,{"index.html":e.content??``}];let i=l(e.type??``,e.language);return[i,h({[i]:e.content})]},[e.type,e.content,e.language,e.title,n]);return{files:a,fileKey:i,template:(0,x.useMemo)(()=>r(e.type??``,e.language),[e.type,e.language]),sharedProps:(0,x.useMemo)(()=>c(e.type??``),[e.type])}}var A=e(y(),1),j=n(),M={javascript:`javascript`,typescript:`typescript`,python:`python`,css:`css`,json:`json`,markdown:`markdown`,html:`html`,xml:`xml`,sql:`sql`,yaml:`yaml`,shell:`shell`,bash:`shell`,tsx:`typescript`,jsx:`javascript`,c:`c`,cpp:`cpp`,java:`java`,go:`go`,rust:`rust`,kotlin:`kotlin`,swift:`swift`,php:`php`,ruby:`ruby`,r:`r`,lua:`lua`,scala:`scala`,perl:`perl`},N={"text/html":`html`,"application/vnd.code-html":`html`,"application/vnd.react":`typescript`,"application/vnd.ant.react":`typescript`,"text/markdown":`markdown`,"text/md":`markdown`,"text/plain":`plaintext`,"application/vnd.mermaid":`markdown`};function P(e,t){return t&&M[t]?M[t]:N[e??``]??`plaintext`}function F(e){return e.index==null?null:{artifactId:e.id,messageId:e.messageId??``,index:e.index}}function I(e,t){return e.artifactId===t.artifactId&&e.messageId===t.messageId&&e.index===t.index}function L(e,t){return e.messageId===t.messageId&&e.index===t.index}var R=function({artifact:e,monacoRef:t,readOnly:n}){let{isSubmitting:r}=a(),o=(n??!1)||r,{setCurrentCode:s}=p(),[c,l]=(0,x.useState)(null),{isMutating:u,setIsMutating:d}=v(),[m,h]=(0,x.useState)(null),g=(0,x.useRef)(e),_=(0,x.useRef)(u),y=(0,x.useRef)(c),S=(0,x.useRef)(s),C=(0,x.useRef)(m),w=(0,x.useRef)(null),T=(0,x.useRef)(()=>{}),E=i({onMutate:e=>{_.current=!0,y.current=e.updated,d(!0),l(e.updated)},onSuccess:(e,t)=>{_.current=!1,y.current=null,d(!1),l(null),h(null);let n=w.current;w.current=null;let r=F(g.current);if(n==null||r==null||!I(n,r))return;let i=L(n,t)?t.updated:n.original;n.code.trim()!==i.trim()&&(S.current(n.code),T.current(n.code,i))},onError:e=>{f(e)===400&&y.current!=null&&(h(y.current),C.current=y.current);let t=w.current;w.current=null,_.current=!1,y.current=null,d(!1),l(null);let n=F(g.current);t==null||n==null||!I(t,n)||t.code.trim()!==t.original.trim()&&(S.current(t.code),T.current(t.code,t.original))}}),D=(0,x.useRef)(E),O=(0,x.useRef)(e.content??``),k=(0,x.useRef)(e.id),M=(0,x.useRef)(o);g.current=e,_.current=u,y.current=c,D.current=E,S.current=s,C.current=m,T.current=(0,x.useCallback)((e,t)=>{let n=g.current,r=F(n);if(o||r==null)return;let i=t??n.content??``;if(_.current){w.current={...r,code:e,original:i};return}let a=e.trim()!==i.trim(),s=y.current==null?!0:e.trim()!==y.current.trim();!a||!s||C.current!=null&&e.trim()===C.current.trim()||(S.current(e),D.current.mutate({index:r.index,messageId:r.messageId,original:i,updated:e}))},[o]);let N=(0,x.useMemo)(()=>(0,A.default)(e=>{T.current(e)},500),[]);(0,x.useEffect)(()=>()=>N.cancel(),[e.id,N]),(0,x.useEffect)(()=>{let n=t.current;if(!n||!o)return;let r=e.content??``,i=O.current;if(r===i)return;let a=n.getModel();if(a){if(r.startsWith(i)&&i.length>0){let e=r.slice(i.length),t=a.getPositionAt(a.getValueLength());a.applyEdits([{range:{startLineNumber:t.lineNumber,startColumn:t.column,endLineNumber:t.lineNumber,endColumn:t.column},text:e}])}else a.setValue(r);O.current=r,n.revealLine(a.getLineCount())}},[e.content,o,t]),(0,x.useEffect)(()=>{if(e.id===k.current)return;k.current=e.id,w.current=null,h(null),O.current=e.content??``;let n=t.current;n&&e.content!=null&&n.getModel()?.setValue(e.content)},[e.id,e.content,t]),(0,x.useEffect)(()=>{if(M.current&&!o&&e.content!=null){let n=t.current;n&&(n.getModel()?.setValue(e.content),O.current=e.content)}M.current=o},[o,e.content,t]);let R=(0,x.useCallback)(e=>{e===void 0||o||(O.current=e,s(e),e.length>0&&N(e))},[o,N,s]),z=(0,x.useCallback)(e=>{let{typescriptDefaults:t,javascriptDefaults:n,JsxEmit:r}=e.languages.typescript,i={noSemanticValidation:!0,noSyntaxValidation:!0},a={allowNonTsExtensions:!0,allowJs:!0,jsx:r.React};t.setDiagnosticsOptions(i),n.setDiagnosticsOptions(i),t.setCompilerOptions(a),n.setCompilerOptions(a)},[]),B=(0,x.useCallback)(n=>{if(t.current=n,O.current=n.getModel()?.getValue()??e.content??``,o){let e=n.getModel();e&&n.revealLine(e.getLineCount())}},[t]),V=P(e.type,e.language),H=(0,x.useMemo)(()=>({readOnly:o,minimap:{enabled:!1},lineNumbers:`on`,scrollBeyondLastLine:!1,fontSize:13,tabSize:2,wordWrap:`on`,automaticLayout:!0,padding:{top:8},renderLineHighlight:o?`none`:`line`,cursorStyle:o?`underline-thin`:`line`,scrollbar:{vertical:`visible`,horizontal:`auto`,verticalScrollbarSize:8,horizontalScrollbarSize:8,useShadows:!1,alwaysConsumeMouseWheel:!1},overviewRulerLanes:0,hideCursorInOverviewRuler:!0,overviewRulerBorder:!1,folding:!1,glyphMargin:!1,colorDecorators:!o,occurrencesHighlight:o?`off`:`singleFile`,selectionHighlight:!o,renderValidationDecorations:o?`off`:`editable`,quickSuggestions:!o,suggestOnTriggerCharacters:!o,parameterHints:{enabled:!o},hover:{enabled:o?`off`:`on`},matchBrackets:o?`never`:`always`}),[o]);return e.content?(0,j.jsx)(`div`,{className:`h-full w-full bg-[#1e1e1e]`,children:(0,j.jsx)(b,{height:`100%`,language:o?`plaintext`:V,theme:`vs-dark`,defaultValue:e.content,onChange:R,beforeMount:z,onMount:B,options:H})}):null};export{k as n,R as t};