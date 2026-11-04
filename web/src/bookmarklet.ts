// Code for the "Add to Meal Plan" bookmark. It runs on the recipe page, opens
// this app's #/import-page in a new tab, waits for that tab to say "ready", and
// hands it the page. Messages go only to this app's own address.
export function bookmarkletSource(appOrigin: string): string {
  const code = `(function(){
var A=${JSON.stringify(appOrigin)};
var w=window.open(A+'/#/import-page','mealplan-import');
if(!w){alert('Allow pop-ups for this site to use Add to Meal Plan.');return;}
var d={type:'mealplan-page',url:location.href,html:document.documentElement.outerHTML};
function h(e){if(e.source===w&&e.data==='mealplan-ready'){w.postMessage(d,A);removeEventListener('message',h);}}
addEventListener('message',h);
setTimeout(function(){removeEventListener('message',h);},20000);
})();`;
  return 'javascript:' + encodeURIComponent(code.replace(/\n/g, ''));
}

/** JavaScript for the iOS Shortcut's "Run JavaScript on Web Page" action. */
export const SHORTCUT_JS = 'completion(JSON.stringify({ url: location.href, html: document.documentElement.outerHTML }));';
