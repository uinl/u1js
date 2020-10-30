/*u1js -- in-browser interpreter for UINL v1.0

	What is UINL?
		UINL is a toolkit-independent language for describing UI updates and interactions.
		It is meant to provide the same access and experience for both human and simulated users.
		http://uinl.github.io/


	Are all optional UI component types and properties from the UINL spec implemented in u1js?
		Not yet.
			UINL does not require for all features to be implemented in UI software.
			Any features that are required by app-side software (i.e., declared via the "require" command)
				that are not implemented will raise an error (i.e. will send {!:Error...} message).
			This is a list of UINL properties and property-values that are not yet implemented:
				>>, A, task, chmax, mark, dfcols, at, play, hash, throt, keymod, overlap,
				+sx, +sy, +rot, +iw, +ih, +cw, +ch,
				C: [ private, pie, media, url, one ],
				man: [ i, null, x, y, rot, dp, z, rx, ry ],
				on: [ mb,mc2,mcc2,md2,mu2,d,dd,du,e,ed,eu,f,fd,fu,g,ga,gb,copy,cut,paste,ended ],
				R: [ mbuf,ipoly,selected,avdesc,avset,dxys,exys,fxys,gamepad,gid,gbtns,gaxes ]
			Additionally, UINL 3D context options are not a part of u1js:
				dp, idp, cdp, bb:[4,5,6,7], cc:[4,5,6,7], sz, rx, ry, axisz
				+dp, +z, +idp, +cdp, +sz, +rx, +ry


	Logging data:
		to enable logging to console, call logToConsole()
		to enable logging to firebase, instantiate firebase, and then call logToFirebase()
		if this is running on volunteerscience.com, logging via volunteerscience API is automatically enabled
		you can overload logline(direction,data) to set up custom logging of uinl messages, for example:
			logline=function(direction,data){fetch('http://myserver.com/log?helloworld',{method:'POST',body:JSON.stringify([direction,data]),headers:{'content-type':'application/json'}})};

*/



"use strict";


const USERAGENT='u1js (v1.0.20201029)';



//////////////////////////////////////////////////////////////////////////////
// Helper functions
location.params={};location.search.substr(1).split("&").forEach(function(a){var b=a.split("=");location.params[b[0]]=b[1]});
function addCSS(css){document.head.appendChild(document.createElement("style")).innerHTML=css;}
function urlInDocument(filetype,urlField,url){
	var x=document.getElementsByTagName(filetype);
	for(var i=0;i<x.length;++i){
		if(x[i][urlField]==url)return true;
	}
}
async function load(urls, callback, onerror, filetype){
	var url, onload, fileref;
	if(urls.constructor===Array){url=urls[0];urls=urls.slice(1);}
	else{url=urls;urls=[];}
	if(urls.length)onload=function(){load(urls,callback,onerror,filetype);};
	else onload=callback||function(){};
	if(url && (url.endsWith(".js")||filetype==='js')){       //if filename is a external JavaScript file
		if(urlInDocument('script','src',url))onload();
		else{
			fileref=document.createElement('script');
			fileref.setAttribute("filetype","text/javascript");
			fileref.setAttribute("src", url);
		}
	}else if(url && (url.endsWith(".css")||filetype==='css')){ //if filename is an external CSS file
		if(urlInDocument('link','href',url))onload();
		else{
			fileref=document.createElement("link");
			fileref.setAttribute("rel", "stylesheet");
			fileref.setAttribute("filetype", "text/css");
			fileref.setAttribute("href", url);
		}
	}else{
		try{eval(url);}
		catch(e){
			console.warn('Adding as a style-sheet:\n'+url);
			addCSS(url);
		}
		onload();
		return;
	}
	if(fileref){
		fileref.onreadystatechange=onload;
		fileref.onload=onload;
		try{
			var urlo=new URL(url);
			fileref.onerror=function(){
				load(urlo.pathname.split('/').pop(),onload,onerror,filetype);
			}
		}catch(e){
			fileref.onerror=onerror||function(e){console.error(e);onload();};
		}
		document.head.appendChild(fileref);
	}
}
Math.round2=(n,r)=>Math.round(n/r)*r;
Date.prototype.format=function(format){
	function twodigit(x){return x<10?'0'+x:x;}
	function threedigit(x){return x<10?'00'+x:(x<100?'0'+x:x);}
	var s="";
	if(format.includes("Y"))s+=this.getUTCFullYear();
	if(format.includes("M"))s+=(s.length?"-":"")+twodigit(this.getUTCMonth()+1);
	if(format.includes("D"))s+=(s.length?"-":"")+twodigit(this.getUTCDate());
	if(format.includes("d"))s+=(s.length?" ":"")+["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][this.getUTCDay()];
	if(format.includes("h"))s+=(s.length?" ":"")+twodigit(this.getUTCHours());
	if(format.includes("m"))s+=(s.length?(format.includes("h")?":":" "):"")+twodigit(this.getUTCMinutes());
	if(format.includes("s"))s+=(s.length?":":"")+twodigit(this.getUTCSeconds());
	if(format.includes("."))s+=(s.length?".":"")+threedigit(this.getUTCMilliseconds());
	return s;
};
HTMLElement.prototype._listen=function(event,fun){
	if(!this._listeners)this._listeners={};
	this.addEventListener(event,fun);
	this._listeners[event]=fun;
}
HTMLElement.prototype._removeListeners=function(){
	if(this._listeners)
		for(var event in this._listeners){
			this.removeEventListener(event,this._listeners[event]);
		}
}
function createSVG(el){return document.createElementNS("http://www.w3.org/2000/svg",el);}
function objectify(o){
	var r={};
	for(var key in o)
		if(typeof(o[key])=='object')r[key]=objectify(o[key]);
		else r[key]=o[key];
	return r;
}
//////////////////////////////////////////////////////////////////////////////



//////////////////////////////////////////////////////////////////////////////
// Logging
//    call logToConsole() to log all uinl messages to console
//    call logToFirebase() to log all uinl messages via Firebase
//    if this code is running via volunteerscience.com, logToVolunteerScience() is automatically called to log all uinl messages via the volunteerscience API
var logline=function(){};
function stopLog(){logline=function(){};}
function logToConsole(){
	logline=function(data){console.log(JSON.stringify(data))};
}
function logToFirebase(){
	function _logToFirebase(){
		firebase.uinlTask='apps/'+(location.host+location.pathname).replace(/\/|\./g,'-');
		firebase.uinlSession='/'+firebase.uinlTask+'/'+firebase.database().ref().child(firebase.uinlTask).push().key;
		var uinlSessionRef=firebase.database().ref(firebase.uinlSession);
		var uinlMsgCnt=0;
		logline=function(data){
			// console.log({[uinlMsgCnt]:JSON.stringify(data)});
			// uinlSessionRef.set({[uinlMsgCnt++]:JSON.stringify(data)});
			firebase.database().ref(firebase.uinlSession+'/'+(uinlMsgCnt++)).set(JSON.stringify(data));
		};
	}
	if(typeof(firebase)!=='undefined')_logToFirebase();
	else load("https://www.gstatic.com/firebasejs/4.11.0/firebase.js",
		function(){
			firebase.initializeApp({apiKey:"AIzaSyCy-9xDsJ5_xYF0iBA9sLcPgmERFgd2JyM",authDomain:"stap-5a32d.firebaseapp.com",databaseURL:"https://stap-5a32d.firebaseio.com",projectId:"stap-5a32d",storageBucket:"stap-5a32d.appspot.com",messagingSenderId:"944783602225"});
			_logToFirebase();
		});
}
function logToVolunteerScience(){
	logline=function(data){
		submit(Date.now()+'\t'+JSON.stringify(data));
	};
}
if(typeof(submit)!=='undefined'&&location.host==="volunteerscience.com")logToVolunteerScience();
//////////////////////////////////////////////////////////////////////////////




//////////////////////////////////////////////////////////////////////////////
// gui object definitions
function gui(data,log=true){
	if(log)logline(data);
	if(data===null){
		gui.resetDisplay();
	}else{
		data=gui.prop(data);
		gui.cancelQ(data);
		if(data._===null||data._===undefined){
			gui.rootContainer._update(data);
		}else{
			gui.rootContainer._searchId(data._.constructor===Array?data._:[data._],data);
		}
		// gui.rootContainer._updateInternalWidth();
		// gui.rootContainer._updateInternalHeight();
	}
}

gui.REQUIRED={
	Mkdn:[
		"https://cdn.jsdelivr.net/npm/marked/marked.min.js",
		"gui.markdown=marked;"
	]
};
gui.TYPES={};
gui.COMMANDS=new Set(['C','!','?','_','*','**','Q','R','S','T','U']);
gui.OPTIONS=new Set(gui.COMMANDS);
gui.OPTION_VALUES_IMPLEMENTED={
	C:v=>(v in gui.TYPES),
	select:v=>[-1,0,1,2].includes(v),
	in:v=>v===0||v===1||v===-1,
	man:v=>['x','y','w','h'].includes(v),
	on:v=>(v in gui.EVENTS)||(v in gui.INFO),
	R:v=>(gui.OPTIONS.has(v) || (v in gui.INFO) || (v in gui.Item.prototype._real)),
};
// gui.INTOPTIONS=new Set(['i','fold','str','opq','bb','cc','dir','z','in','focus','chmax','head']);
// gui.NUMOPTIONS=new Set(['x','y','w','h','sx','sy','rot','iw','ih','cw','ch','max','min','rnd']);
// gui.OBJOPTIONS=new Set(['require','df','in','on','throt','axisx','axisy','tip','keys']);
gui.resetDisplay=function(){
	document.body.innerHTML='';
	gui.rootContainer=new gui.Bin({},document.body);
	gui.rootContainer._parent=null;
	gui.rootContainer._prop.id=null;
	gui.rootContainer._pw=1;
	gui.rootContainer._ph=1;
	document.body._item=gui.rootContainer;
	window._item=gui.rootContainer;
	gui.rootContainer.require=gui.require;
	gui.rootContainer.style=gui.style;
	gui.rootContainer['?']=gui.openExternal;
	gui.rootContainer.title=gui.title;
	gui.rootContainer._sendMsg=gui.sendUserEvent;
}
gui.ums=function(){return Date.now()-gui.startTime;};
gui.sendUserEvent=async function(msg){
	msg.u=gui.ums();
	logline(msg);
	gui.action(msg);
};
gui.vType=function(v){return {undefined:gui.Bin,object:gui.Bin,string:gui.Txt,number:gui.Num,boolean:gui.Btn}[typeof(v)]};
gui.getType=function(prop){if(prop.C && (prop.C in gui.TYPES))return gui.TYPES[prop.C];}
gui.prop=x=>(x.constructor===Object)?x:{v:x};
gui.getColor=v=>getComputedStyle(document.body).getPropertyValue('--color'+v);
gui.color=v=>gui.getColor(v)?`var(--color${v})`:v;
gui.ids={};
gui.uniqueId=function(id){
	var items=gui.ids[id];
	if(items.length==1)return true;
	for(var i=items.length;i--;){
		if(!document.body.contains(items[i]._element))
			items.splice(i,1);
	}
	if(items.length==1)return true;
}
gui.queue={};
gui.cancelQ=function(prop){
	if('Q' in prop){	//clear and remove prior instances of Q-id in timeout queues
		if(prop.Q.constructor===Object){	// Q:{} (wildcard) -- stop/remove all prior timeouts
			for(var q in gui.queue){
				clearTimeout(gui.queue[q]);
				delete gui.queue[q];
			}
		}else{								// Q:<<pid>> -- stop/remove timeouts for specific <<pid>>
			if(gui.queue[prop.Q]){
				clearTimeout(gui.queue[prop.Q]);
				delete gui.queue[prop.Q];
			}
		}
	}
}
gui.animations=new Set();
gui.propWatch=new Set();
gui.loop=function(){
	var now=Date.now(),
		timeStep=now-gui.lastAF,
		item,propName;
	//progress animations
	for(var ani of gui.animations){
		gui.animate(timeStep,ani);
	}
	//go through properties added to watch-list via event-capture option "on"
	for(item of gui.propWatch){
		if(item._propWatch.size&&document.body.contains(item._element)){
			for(propName of item._propWatch)
				item._checkProp(propName);
		}else{
			gui.propWatch.delete(item);
		}
	}
	gui.lastAF=now;
	requestAnimationFrame(gui.loop);
}
gui.lastAF=Date.now();
requestAnimationFrame(gui.loop);
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// general ui directives
gui.require=function(require,loaded){
	var propName,propVal;
	if(!loaded){
		//check if anything in REQUIRED, concat all REQUIRED lists, load and rerun this f
		var toload=[];
		for(var propName in require){
			if(propName in gui.REQUIRED)
				toload=toload.concat(gui.REQUIRED[propName]);
			for(propVal of require[propName])
				if(propVal in gui.REQUIRED)
					toload=toload.concat(gui.REQUIRED[propVal]);
		}
		if(toload.length){
			load(toload,function(){gui.require(require,true)});
			return;
		}
	}
	//collect all options
	var types=[],typep;
	for(var k in gui){
		typep=gui[k].prototype;
		if(typep&&(typep.C||typep.v)){
			gui.TYPES[typep.C]=gui[k]; //this is done in onload, but repeated here in case a new type was loaded
			for(var propName of Object.getOwnPropertyNames(typep)){
				if(typep[propName]!==null && typep[propName].call && !propName.startsWith("_"))
					gui.OPTIONS.add(propName);
			}
		}
	}
	//check that all requested options are implemented
	var errors,errorScreen=[];
	for(var propName in require){
		if(!gui.OPTIONS.has(propName)){
			gui.sendUserEvent({'!':'Sorry, I cannot handle required option: '+propName});
			errorScreen.push({id:'Cannot handle required property option(s)',v:[propName]});
		}else{
			if(propName in gui.OPTION_VALUES_IMPLEMENTED){
				if(require[propName].constructor!==Array)require[propName]=[require[propName]];
				if(require[propName].length===0){
					gui.sendUserEvent({'!':'Sorry, I cannot handle required all possible values for {'+propName+'}'});
					errorScreen.push({id:'Cannot handle all values for required property',v:[propName]});
				}else{
					for(var v of require[propName]){
						if(!gui.OPTION_VALUES_IMPLEMENTED[propName](v)){
							gui.sendUserEvent({'!':'Sorry, I cannot handle required option-value: {'+propName+':'+JSON.stringify(v)+'}'});
							errorScreen.push({id:'Cannot handle required property option(s)',v:['{'+propName+':'+JSON.stringify(v)+'}']});
						}
					}
				}
			}
		}
	}
	if(errorScreen.length){
		gui(null);
		gui([{id:'Error',v:errorScreen}]);
		if(gui.ws)gui.ws.close();
	}
};
gui.style=function(v){load(v)}
gui.openExternal=function(v){window.open(v)}
gui.title=function(v){document.title=(v===null||v===undefined)?'':v;}
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// prototypical gui item
addCSS(`
:root {
--color0: white;
--color1: #444;
--colorHead: #f0f8f8;
--colorBorder: #e8e8e8;
--colorFalse: #f8f8f8;
--colorTrue: lightblue;
--colorLink: #0066ff;
}
* {scrollbar-width:thin;}
scrollbar {width:5px;height:5px;}
a {color:var(--colorLink);cursor:pointer;text-decoration:underline}
::-webkit-scrollbar {width:5px;height:5px;}
::-webkit-scrollbar-thumb {background: rgba(90,90,90,0.3);}
::-webkit-scrollbar-track {background: rgba(0,0,0,0.1);}
body {background-color:var(--color0);color:var(--color1);font-size:18pt;overflow:overlay} 
[level="0"] , [level="0"]>* {margin:0px !important;padding:0px !important;width:100% !important;height:100% !important}
div {position:relative;box-sizing:border-box}
[C] {font-size:90%;border-width:0px;border-style:solid;border-color:#444;stroke:var(--color1);fill:none;overflow:auto;z-index:1;margin:3px;margin-left:6px;}
[C][level="1"] {margin-left:1px}
.title:not(:empty):not(td) {white-space:nowrap;overflow:visible;user-select:none}
.title:empty {margin:0px}
.content {overflow:hidden;border:none;left:0px;right:0px}
.frame {overflow:auto;max-width:100%;max-height:100%;}
[C] {overflow:visible}
*:focus {outline: 0px solid transparent;box-shadow:0px 0px 5px 2px var(--colorTrue) !important;}
`);
gui.Item=class{
	constructor(prop,parent){
		this._parent=parent;																//pointer to parent
		this._initContent();
		this._moveTriggers={};
		this._lockTriggers={};
		this._propWatch=new Set();
		this._propOld={};
		this._content.classList.add('content');
		this._frame.classList.add('frame');
		this._title.classList.add('title');
		this._content._item=this._frame._item=this._element._item=this._outterElement._item=this;
		this._setAttr('C',this.C);
		this._level=parent._level+1;
		this._setAttr('level',this._level);
		this._prop={};
		this._allprop={};																	//._allprop includes own and inherited (via parent defaults) props
		this._initDefaults();
		this._update(Object.assign({},this._typeDefaults,prop));							//refresh attributes based on own properties and class defaults
		for(var propName in this._parent._defaults)											//refresh attributes based on parent defaults
			if(!(propName in this._prop))
				this._refreshProp(propName,this._parent._defaults[propName]);
	}
	_initContent(){
		this._element=document.createElement('div');									//element container (overflow:visible so that shapes/axes can show)
		// this._frame=this._element.appendChild(document.createElement('div'));			//content frame (overflow:auto so that content can be scrolled)
		this._title=this._element.appendChild(document.createElement('div'));				//title (this is where id/title goes)
		this._content=this._element.appendChild(document.createElement('div'));			//content (includes value)
		this._frame=this._content;
		this._parent._placeChildElement(this);
	}
	_initDefaults(){}
	_beforeRemove(){}
	_attr(attr){return this._element.getAttribute(attr);}
	_setAttr(attr,val){
		if(val===null)this._element.removeAttribute(attr);
		else this._element.setAttribute(attr,val);
	}
	// _numOptions(propName){return gui.NUMOPTIONS.has(propName)}
	_delay(prop,delay){
		var timeoutId=setTimeout(()=>{
				if('Q' in prop)delete gui.queue[prop.Q];
				this._update(prop);
			},delay);
		if('Q' in prop)gui.queue[prop.Q]=timeoutId;
	}
	_update(prop){
		if(prop.U){				//delay current message until a specific time
			let delay=prop.U-gui.ums();
			delete prop.U;
			this._delay(prop,delay);
		}else if(prop.S){		//delay current message a few seconds
			let delay=prop.S*1000;
			delete prop.S;
			this._delay(prop,delay);
		}else if(prop.T){		//delay current message until a specific trigger
			//TODO: 
		}else{
			var r=prop.R;											//if there is an R command, save it for later
			if(r)delete prop.R;
			if('*' in prop && this._searchStar){					//if there is a * command, search and update matching child items
				var searchTerms=prop['*'];
				delete prop['*'];
				this._searchStar(searchTerms,prop);
			}else if('**' in prop && this._searchRecur){			//if there is a ** command, search and update matching descendant items
				var searchTerms=prop['**'];
				delete prop['**'];
				this._searchRecur(searchTerms,prop);
			}else if(prop.v===null){								//if v==null, delete this item
				this._prop.v=null;
				if(this._parent)this._parent._removeChild(this);
				else gui.resetDisplay();
			}else{
				for(var propName in prop){
					this._updateProp(propName,prop[propName]);
				}
			}
			if(r){
				this.R(r,prop.Q);
			}
		}
	}
	_updateProp(propName,propVal){
		if(propVal===null&&propName in this._typeDefaults){
			propVal=this._typeDefaults[propName];
		}else if(propVal===9e99){
			propVal=Infinity;
		}else if(propVal===-9e99){
			propVal=-Infinity;
		}else if(propName==='v' && this.C==='num' && typeof(propVal)==='string'){
			propVal=NaN;
		// }else if(propVal && propVal.constructor===Object && (this._numOptions(propName) || gui.INTOPTIONS.has(propName))){
			// var v=(propName in this._allprop)?this._allprop[propName]:(this._typeDefaults[propName]||0);
			// if('^=' in propVal)v**=propVal['^='];
			// if('*=' in propVal)v*=propVal['*='];
			// if('+=' in propVal)v+=propVal.vy;
			// if('max' in propVal)v=Math.max(v,propVal['max']);
			// if('min' in propVal)v=Math.min(v,propVal['min']);
			// if(gui.INTOPTIONS.has(propName))v=Math.round(v);
			// this._prop[propName]=propVal=v;
		}else if(this._prop[propName]&&this._prop[propName].constructor===Object){
			Object.assign(this._prop[propName],propVal);
		}else{
			this._prop[propName]=propVal;
		}
		this._refreshProp(propName,propVal);
	}
	_refreshProp(propName,propVal){
		try{
			if(this[propName] && propName!=='C'){// && (propName==='sy'||propName==='sx'||this._allprop[propName]!==propVal)){
				//save in _allprop (or delete if null)
				if(propVal===null)
					delete this._allprop[propName];
				else if(this._allprop[propName]&&this._allprop[propName].constructor===Object)
					Object.assign(this._allprop[propName],propVal);
				else
					this._allprop[propName]=propVal;
				//run the class-specific property function
				this[propName](propVal);
				//set DOM attribute
				if(propName==='v'){
					if(propVal.constructor===Boolean)this._setAttr('v',propVal);
					else this._moveHook();
				}else if(!gui.COMMANDS.has(propName)){
					this._setAttr(propName,typeof(propVal)==='object'?'':propVal);
				}
			}
		}catch(e){
			console.error(e.stack);
			this._sendMsg({'!':`Problem setting ${propName} to ${propVal} :: [[${e.stack}]]`});
		}
	}
	_getIndex(){
		var i=0,e=this._outterElement;
		while((e=e.previousElementSibling)!==null)
			if(e._item)++i;
		return i;
	}
	_match(query){
		if(query.constructor===Object){
			for(var q in query){
				if(q==='C'){
					if(this.C!==query[q])return false;
				}else if(this._prop[q]&&query[q].constructor===Array){
					var keys=this._prop[q].constructor===Array?this._prop[q]:Object.keys(this._prop[q]);
					for(var key of query[q])
						if(!keys.includes(key))return false;
				}else{
					if(query[q]!==this._prop[q])return false;
				}
			}
			return true;
		}
	}
	_uniqueId(){return !this._parent||(this._prop.id && gui.uniqueId(this._prop.id));}
	_getId(){
		if(this._uniqueId()){
			return this._prop.id||this._getIndex();
		}else{
			var parent=this._parent,
				fullname=[this._prop.id||this._getIndex(),parent._prop.id||parent._getIndex()];
			while(!parent._uniqueId()){
				parent=parent._parent;
				fullname.push(parent._prop.id||parent._getIndex());
			}
			return fullname.reverse();
		}
	}
	_sendMsg(msg){
		msg._=this._getId();
		gui.sendUserEvent(msg);
	}
	_moveHook(){
		for(var f in this._moveTriggers){
			this._moveTriggers[f]();
		}
		// var h;
		// if(this._parent && !this._parent._allprop.ch && (h=this._element.offsetTop+this._element.offsetHeight)>this._parent._content.offsetHeight){
			// console.log(this._allprop,this._parent._allprop,h);
			// this._parent._content.style.height=h;
		// }
		// console.log('hee',h);
	};
	v(v){this._content.innerHTML=v;}
	id(v){
		this._parent._childmap[v]=this;
		this.title();
		var iditems=gui.ids[v];
		if(iditems)iditems.push(this);
		else gui.ids[v]=[this];
	}
	title(v){this._title.innerHTML=(v===null||v===undefined)?this._prop.id:v;}
}
gui.Item.prototype['!']=function(v){console.error(this._allprop,v);};
gui.Item.prototype._typeDefaults={};
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// text items
addCSS(`
[C='txt'] > .title:empty {width:0px;height:0px;overflow:hidden}
[C='txt'] > .title:not(empty) {border-bottom:solid 1px var(--colorBorder);width:25%;}
[C='txt'] > .content {white-space:pre-wrap}
[C='txt'][id] > .content {margin-left:.5em}
[C='txt'][title]:not([title='']) > .content {margin-left:.5em}
`);
gui.Txt=class extends gui.Item{}
gui.Txt.prototype.C='txt';
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// number items
addCSS(`
[C='num'] * {display:inline-block;vertical-align:middle}
[C='num'] > .title:empty {width:0px;height:0px;overflow:hidden}
[C='num'] > .title:not(:empty) {border-bottom:solid 1px var(--colorBorder);vertical-align:bottom;margin-top:inherit;margin-right:.75em}
[C='num'] > .title:not(:empty):after {content:":"}
[C='num'] > .content {display:inline-block}
`);
gui.Num=class extends gui.Item{
	_initContent(){
		this._element=document.createElement('div');									//element container (overflow:visible so that shapes/axes can show)
		this._frame=this._element;
		this._title=this._frame.appendChild(document.createElement('div'));				//title (this is where id/title goes)
		this._content=this._frame.appendChild(document.createElement('div'));			//content (includes value)
		this._parent._placeChildElement(this);
	}
	// _numOptions(propName){return propName==='v'||gui.NUMOPTIONS.has(propName)}
}
gui.Num.prototype.C='num';
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// boolean items
addCSS(`
[in="1"] {cursor:pointer;user-select:none;-moz-user-select:none;}
[in="0"] {pointer-events:none;opacity:.5;}
[C='btn']:active {background-color:var(--colorTrue) !important;}
[C='btn'] {text-align:center;display:inline-block;padding:.4em;background-color:var(--colorFalse);vertical-align:middle;}
[C='btn'] > * {display:inline-block}
[C='btn']:not([shp]) {box-shadow:0px 0px 3px 1px rgba(0, 0, 0, 0.3)}
[C='btn'][shp] {filter:drop-shadow(0px 0px 3px rgba(0, 0, 0, 0.7))}
[C='btn']:not(:empty),[select="0"]:not(:empty) {min-width:100px;border-radius:4px;}
[C='btn'][in]:empty {width:1em;height:1em;border-radius:2em;}
[btnContainer] [C='btn'] {display:none}
[btnContainer]:active {background-color:var(--colorTrue) !important;}
[btnContainer]:not([C='tableRow']) {box-shadow:0px 0px 3px 1px rgba(0, 0, 0, 0.3);cursor:pointer;border-radius:4px;}
[v="true"]:not([C='txt']) {background-color:var(--colorTrue) !important;}
`);
gui.Btn=class extends gui.Item{
	_initContent(){
		this._element=document.createElement('div');			//make element inside parent
		this._setAttr('tabindex',0);
		this._element.onkeydown=function(e){if(!e.repeat&&(e.keyCode==32||e.keyCode===13)){this._item._btnDown();e.preventDefault();e.stopPropagation()}};
		this._element.onkeyup=function(e){if(e.keyCode==32||e.keyCode===13){this._item._btnUp();e.preventDefault();e.stopPropagation()}};
		this._frame=this._element;
		this._content=this._element;
		this._title=this._frame.appendChild(document.createElement('div'));				//title (this is where id/title goes)
		// this._title=this._element;
		this._parent._placeChildElement(this);
		this._bind(this);
	}
	v(v){
		if(v){
			if(this._boundTo && this._boundTo!==this){
				this._boundTo._setAttr('v',v);
			}
			if(this._allprop.in===1)
				setTimeout(()=>this._updateProp('v',false),200);
		}
	}
	_btnDown(){this._setAttr('v',true);}
	_btnUp(){this._setAttr('v',false);this._boundTo._element.onclick();}
	_bind(item){
		var thisItem=this;
		this._boundTo=item;
		if(this._unbind)this._unbind();
		if(this._allprop){
			item._setAttr('in',this._allprop.in);
		}
		item._element.onclick=function(){							//click behavior
			thisItem._sendMsg({v:true});
		}
		this._unbind=function(){item._element.onclick=null;}
	}
}
gui.Btn.prototype.C='btn';
gui.Btn.prototype._typeDefaults={in:1};
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// containers
addCSS(`
[C='bin']:not([tag]):not([shp]):not([h]):not([level='0']) {border-left: solid 0.2px #ccc}
[C='bin'][id]:not([title='']):not([y]) , [C='bin'][title]:not([title='']):not([y]) {margin-top:1.5em}
[C='bin'] > .title:empty {display:none}
[C='bin'] > .title:not(empty) {position:absolute;bottom:100%;border-bottom:solid 1px var(--colorBorder);}
[C='bin'] > .content {display:block}
`);
gui.Bin=class extends gui.Item{
	_initContent(){
		this._element=document.createElement('div');									//element container (overflow:visible so that shapes/axes can show)
		this._title=this._element.appendChild(document.createElement('div'));			//title (this is where id/title goes)
		this._frame=this._element.appendChild(document.createElement('div'));			//content frame (overflow:auto so that content can be scrolled)
		this._content=this._frame.appendChild(document.createElement('div'));			//content
		// this._title=this._content.appendChild(document.createElement('div'));			//title (this is where id/title goes)
		this._parent._placeChildElement(this);
	}
	_initDefaults(){
		this._defaults=Object.assign({},this._parent._defaults);
		this._children=[];
		this._childmap={};
	}
	*[Symbol.iterator](){
		// var i,child;
		// for(i=this._content.children.length;i--;){
			// child=this._content.children[i]._item;
			// if(child)yield child;
		// }
		for(var i=this._children.length;i--;){
			yield this._children[i];
		}
	}
	_getChild(id){
		if(typeof(id)==='number'){								//find child by order
			// for(var i=0,eid=0;i<this._content.children.length;i++)
				// if(this._content.children[i]._item){
					// if(eid==id)return this._content.children[i]._item;
					// eid++;
				// }
			return this._children[id];
		}else if(typeof(id)==='string')							//find child by id
			return this._childmap[id];
	}
	_placeChildElement(child){
		this._content.appendChild(child._element);
		child._outterElement=child._element;
	}
	_checkContainerBool(){
		var boolItem;
		for(var child of this){
			if(child instanceof gui.Btn)
				if(boolItem)return null;
			else
				boolItem=child;
		}
		if(boolItem && (boolItem._allprop.title=='' || (!boolItem._allprop.title && !boolItem._prop.id)))
			return boolItem;
	}
	_newChild(prop){
		var type=gui.getType(prop);
		if(!type){
			var defaultType=gui.getType(this._defaults);
			if('v' in prop){
				type=gui.vType(prop.v);
				if(defaultType&&(defaultType.prototype instanceof type))
					type=defaultType;
			}else if(defaultType){
				type=defaultType;
			}else if('v' in this._defaults){
				type=gui.vType(this._defaults.v);
			}else{
				type=gui.Bin;
				prop.v=[];
			}
		}
		var child=new type(prop,this);
		this._children.push(child);
	}
	_removeChild(child){
		child._beforeRemove();										//cleanup
		if(child._prop.id)delete this._childmap[child._prop.id];	//remove from _childmap
		this._children.splice(this._children.indexOf(child),1);		//remove from _children
		this._content.removeChild(child._outterElement);			//remove DOM element
	}
	_searchStar(searchTerms,prop){
		for(var child of this){
			if(child._match(searchTerms))
				child._update(prop);
		}
	}
	_searchRecur(searchTerms,prop){
		for(var child of this){
			if(child._match(searchTerms))
				child._update(prop);
			if(child instanceof gui.Bin)
				child._searchRecur(searchTerms,prop);
		}
	}
	_searchId(id,prop){
		var child=this._getChild(id[0]);
		if(child){
			if(id.length>1){
				return child._searchId(id.slice(1),prop);
			}else{
				if(prop)child._update(prop);
				return child;
			}
		}else{
			for(var child of this){
				if(child instanceof gui.Bin){
					var c=child._searchId(id,prop);
					if(c)return c;
				}
			}
		}
	}
	_processProp(prop){
		gui.cancelQ(prop);
		if('_' in prop){								//edit child
			this._searchId(prop._.constructor===Array?prop._:[prop._],prop);
		}else if(('*' in prop)||('**' in prop)){		//edit children/descendants
			this._update(prop);
		}else if(prop.v!==null){						//new child
			this._newChild(prop);
		}
	}
	v(updates){
		//clear bin if updates==[]
		if(updates[0]===null){
			for(var child of this)this._removeChild(child);
			updates.shift();
		}
		//cycle through all updates for this container
		for(var i of updates)
			if(i!==null)
				this._processProp(gui.prop(i));
		//after updates are done, check if there's an untitled boolean value (for a cleaner look&feel)
		var cbool=this._checkContainerBool();
		if(this._containerBoolean && cbool!=this._containerBoolean && this._containerBoolean._unbind)
			this._containerBoolean._unbind();
		this._containerBoolean=cbool;
		if(this._containerBoolean){
			this._containerBoolean._bind(this);
			this._setAttr('btnContainer',1);
			this._setAttr('v',Boolean(this._containerBoolean._allprop.v));
		}else{
			this._setAttr('btnContainer',null);
		}
	}
}
gui.Bin.prototype.C='bin';
//////////////////////////////////////////////////////////////////////////////



//////////////////////////////////////////////////////////////////////////////
// initiate gui and connect to app
var app={};		//global reference to app software
(function(){	//onload: initiate rootContainer and connect to app software
	//////////////////////////////////////////////////////////////////////////////
	// init window and connect to app
	function init(){
		//collect all types
		Object.values(gui).filter(v=>v.prototype&&v.prototype.C).forEach(c=>gui.TYPES[c.prototype.C]=c);
		//create foundational element
		document.body._level=-1;
		document.body._content=document.body;
		document.body._placeChildElement=function(child){
			this._content.appendChild(child._element);
			child._outterElement=child._element;
		}
		gui.resetDisplay();
		//connect to app
		if(app.userAction || app.start){
			//if app code is client-side script...
			connectToTaskScript();
		}else if(app.location || location.params.l){
			// load url if one is supplied...
			gui(['Loading...']);
			app.location=app.location || location.params.l;
			if(app.location.startsWith('ws://') || app.location.startsWith('wss://'))
				connectToTaskWS();
			else
				connectToTaskHTTP();
		}else{
			gui(['Hey there...',{id:'Intersted in the UINL?',v:"http://uinl.github.io/"}]);
		}
	}
	function onTaskConnect(){
		gui.startTime=Date.now();
	}
	function connectToTaskScript(){
		//	connect gui.action to app.userAction
		if(app.userAction)gui.action = app.userAction;
		//	connect app.display to gui.update;
		app.display=function(data){gui(JSON.parse(JSON.stringify(data)));};
		//	define app.end
		app.end=function(){};
		//	start app
		onTaskConnect();
		if(app.start)app.start();
	}
	function connectToTaskHTTP(){
		function onReady(){
			if(this.readyState==4){
				if(this.status==200){
					gui.httpParrotHeader=null;
					gui.httpAppendToURL=null;
					this.getAllResponseHeaders().split('\n').forEach(line=>{
						if(line.substr(0,9).toLowerCase()==('x-parrot:'))gui.httpParrotHeader=line.substr(10);
						if(line.substr(0,16).toLowerCase()==('x-append-to-url:'))gui.httpAppendToURL=line.substr(17);
					});
					try{
						//gui(JSON.parse(this.responseText));
						var arrayOfLines=this.responseText.match(/[^\r\n]+/g);
						if(arrayOfLines){
							for(var i=0;i<arrayOfLines.length;i++){
								gui(JSON.parse(arrayOfLines[i]));
							}
						}
					}
					catch(e){console.error('Could not parse response.\n',this.responseText);}
				}else if(this.status>200 && this.status<400){
					var url=new URL(this.responseText);
					console.log(this.statusText+'\n  '+url.href);
					app.location=url.href;
					gui.sendUserEvent({});
				}
			}
		}
		function post(url,body=''){
			var xhttp = new XMLHttpRequest();
			xhttp.onreadystatechange = onReady;
			if(gui.httpAppendToURL)url+=(url.includes('?')?'&':'?')+gui.httpAppendToURL;
			xhttp.open("POST",url, true);
			if(gui.httpParrotHeader)xhttp.setRequestHeader('X-parrot',gui.httpParrotHeader);
			xhttp.send(body);
		}
		function get(url){
			var xhttp = new XMLHttpRequest();
			xhttp.onreadystatechange = onReady;
			if(gui.httpAppendToURL)url+=(url.includes('?')?'&':'?')+gui.httpAppendToURL;
			xhttp.open("GET",url, true);
			// if(gui.httpParrotHeader)xhttp.setRequestHeader('X-parrot',gui.httpParrotHeader);
			xhttp.send();
		}
		gui.action=function(time,id,val){
			post(app.location,JSON.stringify([time,id,val]));
		};
		gui.action(0,null,['onload']);
		onTaskConnect();
	}
	function connectToTaskWS(){
		if("WebSocket" in window){
			gui.action = function(time,id,val){
				gui.ws.send(JSON.stringify([time,id,val]));
			}
			gui.ws=new window.WebSocket(app.location);
			gui.ws.onerror=function(e){gui(null);gui({'!':'Cannot establish connection to '+app.location});};
			gui.ws.onopen=onTaskConnect;
			gui.ws.onclose=function(event){
				console.log('Connection closed ('+event.code+').');
				//gui(['Connection closed.']);
			};
			gui.ws.onmessage=function(msg){
				gui(JSON.parse(msg.data));
			};
		}else{
			gui(null);
			gui([{id:'Error',v:'Your browser does not support websockets. Please use a modern browser to run this application.'}]);
		}
	}
	//////////////////////////////////////////////////////////////////////////////
	window.addEventListener("load",init);
})();
//////////////////////////////////////////////////////////////////////////////




//
// above this line are:
//   core UINL text&button features, title, & delayed update commands (QSTU)
//////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////
// below this line are:
//   additional UI features (e.g. checkboxes, tables, inputs, events, graphics, emphases)
//




//////////////////////////////////////////////////////////////////////////////
// U command (true info)
gui.INFO={
	async ip(){return gui.ip=await fetch('https://api.ipify.org/').then(r=>r.text());},
	userAgent(){return USERAGENT+'; '+navigator.userAgent;},
	url(){return location.href;},
	screen(){return objectify(screen);},
	time(){
		var t=new Date();
		var tzo = -t.getTimezoneOffset(),
			dif = tzo >= 0 ? '+' : '-',
			pad = function(num) {
				var norm = Math.floor(Math.abs(num));
				return (norm < 10 ? '0' : '') + norm;
			};
		return t.getFullYear() +
			'-' + pad(t.getMonth() + 1) +
			'-' + pad(t.getDate()) +
			'T' + pad(t.getHours()) +
			':' + pad(t.getMinutes()) +
			':' + pad(t.getSeconds()) +
			'.' + pad(t.getMilliseconds()) +
			dif + pad(tzo / 60) +
			':' + pad(tzo % 60);
	},
	v(item){
		if(item instanceof gui.Bin){
			var childprop,v=[];
			for(var child of item){
				childprop=Object.assign({},child._prop);
				childprop.v=gui.INFO.v(child);
				v.push(childprop);
			}
			return v;
		}else{
			return item._allprop.v;
		}
	},
	i(item){return item._getIndex()},
	sx(item){return item._frame.scrollLeft/item._getPw()},
	sy(item){return item._frame.scrollTop/item._getPh()},
	cw(item){return item._allprop.cw||(Math.max(item._content.offsetWidth,item._content.scrollWidth)/item._getPw())},
	ch(item){return item._allprop.ch||(Math.max(item._content.offsetHeight,item._content.scrollHeight)/item._getPh())},
	w(item){return item._element.offsetWidth/(item._getParentPw()||1)},
	h(item){return item._element.offsetHeight/(item._getParentPh()||1)},
	x(item){return item._element.offsetLeft/(item._getParentPw()||1)}, //TODO: make sure this works for bb/cc
	y(item){return item._element.offsetTop/(item._getParentPh()||1)} //TODO: make sure this works for bb/cc
}
gui.Item.prototype.R=async function(v,qid){
	var msg={};
	for(var info of v){
		if(info==='q')msg['q']=qid;
		else if(info in gui.INFO)msg[info]=await gui.INFO[info](this);
		else msg[info]=this._allprop[info];
		if(msg[info]===undefined)msg[info]=null;
	}
	this._sendMsg(msg);
}
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// additional item properties
addCSS(`
.tooltiptext {visibility:hidden;background-color:black;text-align:left;border-radius:0px;padding:5px;margin:0px;position:fixed;bottom:0px;left:0px;z-index:999}
.tooltiptext > div {padding:0px;margin:0px;color:#ddd;font-size:9pt;font-family:Arial;text-shadow:none;}
.tooltiptext > div:first-child {font-weight:bold}
[fold="1"] {display:block;margin-bottom:30}
[fold="1"] .content {display:none}
[fold="1"]>.title {position:relative !important;box-shadow:0px 7px 7px -4px rgba(0,0,0,0.75) !important;display:inline}
[fold="1"]>.title:after {content:"...";margin:10px;padding:2px;border-radius:2px}
[fold='1']>.title:before {content:'+'}
[fold='2']>.title:before {content:'-'}
[fold='1']>.title , [fold='2']>.title {cursor:pointer;user-select:none}
[fold='1']>.title:before , [fold='2']>.title:before {border:solid 1px gray;margin-right:.5em;border-radius:2px;display:inline-block;width:1em;height:1em;text-align:center;vertical-align:middle}
[fold='1']>.title:focus , [fold='2']>.title:focus {box-shadow:none;border:none !important;outline:none;}
[fold='1']>.title:focus:before , [fold='2']>.title:focus:before {box-shadow: 0px 0px 5px 2px var(--colorTrue)}
`);
gui.tooltipOn=function(e){
	if(!gui.tooltip){
		gui.tooltip=document.body.appendChild(document.createElement('span'));
		gui.tooltip.setAttribute('class','tooltiptext');
	}
	gui.tooltip.innerHTML='';
	for(var tip of this._item._allprop.tip){
		var tipblock=gui.tooltip.appendChild(document.createElement('div'));
		tipblock.innerHTML=tip;
	}
	gui.tooltip.style.visibility='visible';
};
gui.tooltipOff=function(e){gui.tooltip.style.visibility='hidden';};
gui.Item.prototype.i=function(v){
	var parent=this._parent;
	if(parent && parent._children[v]!==this){
		parent._children.splice(parent._children.indexOf(this),1);	//remove from _children array
		if(v<parent._children.length){
			parent._content.insertBefore(this._outterElement,parent._children[v]._outterElement);
			parent._children.splice(v,0,this);
		}else{
			parent._content.appendChild(this._outterElement);
			parent._children.push(this);
		}
	}
};
gui.Item.prototype.tip=function(v){
	if(v){
		this._element.addEventListener('mouseenter',gui.tooltipOn);
		this._element.addEventListener('mouseleave',gui.tooltipOff);
	}else{
		this._element.removeEventListener(gui.tooltipOn);
		this._element.removeEventListener(gui.tooltipOff);
	}
}
gui.Bin.prototype.fold=function(v){
	if(v){
		var thisItem=this;
		this._title.onclick=()=>{thisItem._updateProp('fold',-1*v)};
		this._title.setAttribute('tabindex','0');
		this._title.onkeydown=function(e){if(e.keyCode===32||e.keyCode===13){e.preventDefault();e.stopPropagation()}};
		this._title.onkeyup=function(e){if(e.keyCode===32||e.keyCode===13){thisItem._title.onclick();e.preventDefault();e.stopPropagation()}};
	}else{
		this._title.onclick=null;
		this._title.removeAttribute('tabindex');
		this._title.onkeydown=null;
		this._title.onkeyup=null;
	}
}
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// interactive options/events
addCSS(`
[in="-1"] {pointer-events:none}
.controlWidth {z-index:10000;cursor:ew-resize;height:50%;width:0px;border-right:dotted 3px gray;position:absolute;right:-2.5px;top:25%}
.controlHeight {z-index:10000;cursor:ns-resize;width:50%;height:0px;border-bottom:dotted 3px gray;position:absolute;bottom:-2.5px;left:25%}
[man*='x'],[man*='y'] {cursor:move}
`);
//manipulation controls------
gui.Item.prototype.man=function(v){
	if(v && v.constructor===Array){
		const element=this._element,item=this;
		//------------w/h manipulation------------
		if(v.includes('w')){
			if(!this._manW){
				this._manW=element.appendChild(document.createElement('div'));
				this._manW.className='controlWidth';
				this._manW.setAttribute('draggable','true');
				this._manW.addEventListener('drag',e=>{
					const x=element.getBoundingClientRect().left;
					if(e.clientX>(x+1)){
						element.style.width=e.clientX-x;
						// gui.updateInternalWidths();
					}
				});
				this._manW.addEventListener('dragend',e=>item._sendMsg({w:gui.INFO.w(item)}));
			}
		}else if(this._manW){
			this._element.removeChild(this._manW);
		}
		if(v.includes('h')){
			if(!this._manH){
				this._manH=element.appendChild(document.createElement('div'));
				this._manH.className='controlHeight';
				this._manH.setAttribute('draggable','true');
				this._manH.addEventListener('drag',e=>{
					const y=element.getBoundingClientRect().top;
					if(e.clientY>(y+1)){
						element.style.height=e.clientY-y;
						// gui.updateInternalHeights();
					}
				});
				this._manH.addEventListener('dragend',e=>item._sendMsg({h:gui.INFO.h(item)}));
			}
		}else if(this._manH){
			this._element.removeChild(this._manH);
		}
		//------------x/y manipulation------------
		const moveX=v.includes('x'),moveY=v.includes('y');
		if(moveX||moveY){
			const parentNode=this._element.parentNode;
			let f={};
			if(moveX&&moveY){
				f.move=e=>{
					element.style.left=e.clientX+f.offsetX;
					element.style.top=e.clientY+f.offsetY;
				};
			}else if(moveX){
				f.move=e=>{element.style.left=e.clientX+f.offsetX};
			}else{
				f.move=e=>{element.style.top=e.clientY+f.offsetY};
			}
			f.removeMouseMove=function(){
				parentNode.removeEventListener('mousemove',f.move,false);
				parentNode.removeEventListener('mouseup',f.removeMouseMove,false);
				parentNode.removeEventListener('mouseleave',f.removeMouseMove,false);
				var r={};
				if(moveX)r.x=gui.INFO.x(item);
				if(moveY)r.y=gui.INFO.y(item);
				item._sendMsg(r);
			}
			this._content.onmousedown=this._title.onmousedown=(e)=>{
				f.offsetX=parseInt(element.offsetLeft)-e.clientX;
				f.offsetY=parseInt(element.offsetTop)-e.clientY;
				parentNode.addEventListener('mousemove',f.move,false)
				parentNode.addEventListener('mouseup',f.removeMouseMove,false);
				parentNode.addEventListener('mouseleave',f.removeMouseMove,false);
				e.preventDefault();
			};
		}else{
			//todo: remove event listener
		}
		//------------i/null manipulation---------
		//todo: ...
	}else{
		//todo: remove all controls
	}
}
gui.Item.prototype.focus=function(v){
	if(this._allprop.in>0){
		if(v)this._content.focus();
		else this._content.blur();
	}
}
//TODO: mb, mc2, mcc2, md2, mu2, copy (w drag), cut, paste (w drop), ended
//mouse events---------------
gui.EVENTSjs={
	mousemove:'m',
	mousedown:'md',
	mouseup:'mu',
	click:'mc',
	dblclick:'mcc'
};
gui.sendEventXY=function(e){
	var item=this._item,x,y,r=item._content.getBoundingClientRect();
	x=(e.clientX-r.left)/(item._getPw()||1);
	y=(e.clientY-r.top)/(item._getPh()||1);
	item._event(gui.EVENTSjs[e.type],[x,y]);
}
//scroll events--------------
gui.checkSx=function(){
	var sx=gui.INFO.sx(this._item);
	if(sx!==this._item._allprop.sx){
		this._item._allprop.sx=sx;
		this._item._event('sx',sx);
	}
}
gui.checkSy=function(){
	var sy=gui.INFO.sy(this._item);
	if(sy!==this._item._allprop.sy){
		this._item._allprop.sy=sy;
		this._item._event('sy',sy);
	}
}
//loop events----------------
gui.Item.prototype._checkProp=function(propName){
	var val=gui.INFO[propName](this);
	if(val!==this._propOld[propName]){
		this._propOld[propName]=val;
		if(propName==='w'){
			if(this._allprop.on && this._allprop.on.w)this._event('w',val);
			if(this._allprop.iw)this._updateInternalWidth();
		}else if(propName==='h'){
			if(this._allprop.on && this._allprop.on.h)this._event('h',val);
			if(this._allprop.ih)this._updateInternalHeight();
		}else{
			this._event(propName,val);
		}
	}
}
//overlap event--------------
gui.waitingForItems={};
gui.waitingFor=function(){
	for(var uidjson in gui.waitingForItems){
		var item,uid=JSON.parse(uidjson);
		if(item=gui.rootContainer._searchId(uid.constructor===Array?uid:[uid])){
			gui.waitingForItems[uidjson](item);
			delete gui.waitingForItems[uidjson];
			return;
		}
	}
	if(Object.keys(gui.waitingForItems).length)
		setTimeout(gui.waitingFor,30);
}
gui.overlap=function(b1,b2){
	if(b1.left>b2.right||b2.left>b1.right||b1.top>b2.bottom||b2.top>b1.bottom)return false;
	return true;
}
gui.Item.prototype._addOverlapTarget=function(targetKey,item){
	this._overlapTargets[targetKey]=item;
	if(item._overlapSeekers)
		item._overlapSeekers.add(this);
	else
		item._overlapSeekers=new Set([this]);
	item._moveTriggers.overlapT=()=>item._checkOverlapT();
}
gui.Item.prototype._overlapChecking=function(){
	if(this._allprop.on&&this._allprop.on.o){
		this._moveTriggers.overlap=()=>this._checkOverlap();
		this._overlapTargets={};
		this._priorOverlap=new Set();
		for(var t of this._allprop.on.o){
			var targetKey=JSON.stringify(t);
			var item=gui.rootContainer._searchId(t);
			if(item){
				this._addOverlapTarget(targetKey,item);
			}else{
				gui.waitingForItems[targetKey]=item=>this._addOverlapTarget(targetKey,item);
				gui.waitingFor();
			}
		}
	}else{
		delete this._moveTriggers.overlap;
		for(var item of this._overlapTargets){
			item._overlapSeekers.delete(this);
			if(!item._overlapSeekers.size)
				delete item._moveTriggers.overlapT;
		}
	}
}
gui.Item.prototype._sendOverlaps=function(){
	var item,overlaps=[];
	for(item of this._priorOverlap)
		overlaps.push(item._getId());
	this._sendMsg({o:overlaps});
}
gui.Item.prototype._checkOverlap=function(){
	var stateChanged,i,targetKey,item,myBounds=this._element.getBoundingClientRect();
	for(targetKey in this._overlapTargets){
		item=this._overlapTargets[targetKey];
		if(document.body.contains(item._element)){
			if(gui.overlap(item._element.getBoundingClientRect(),myBounds)){
				if(!this._priorOverlap.has(item)){
					this._priorOverlap.add(item);
					stateChanged=true;
				}
			}else if(this._priorOverlap.has(item)){
				this._priorOverlap.delete(item);
				stateChanged=true;
			}
		}else{
			delete this._overlapTargets[targetKey];
			gui.waitingForItems[targetKey]=item=>this._addOverlapTarget(targetKey,item);
			gui.waitingFor();
		}
	}
	if(stateChanged)
		this._sendOverlaps();
}
gui.Item.prototype._checkOverlapT=function(){
	var stateChanged,item,myBounds=this._element.getBoundingClientRect();
	for(item of this._overlapSeekers){
		if(document.body.contains(item._element)){
			if(gui.overlap(item._element.getBoundingClientRect(),myBounds)){
				if(!item._priorOverlap.has(this)){
					item._priorOverlap.add(this);
					item._sendOverlaps();
				}
			}else if(item._priorOverlap.has(this)){
				item._priorOverlap.delete(this);
				item._sendOverlaps();
			}
		}else{
			this._overlapSeekers.delete(item);
			if(!this._overlapSeekers.size)
				delete this._moveTriggers.overlapT;
		}
	}
}
//event functions------------
gui.EVENTS={
	v:{input:function(e){this._item._event('v',this._item._allprop.v)}},
	sx:{scroll:gui.checkSx},
	sy:{scroll:gui.checkSy},
	o:null, //defined above
	focus:{"focus":function(e){this._item._event('focus',1)},"blur":function(e){this._item._event('focus',0)}},
	me:{"mouseenter":function(e){this._item._event('me',1)},"mouseleave":function(e){this._item._event('me',0)}},
	m:{"mousemove":gui.sendEventXY},
	mc:{"click":gui.sendEventXY},
	mcc:{"dblclick":gui.sendEventXY},
	md:{"mousedown":gui.sendEventXY},
	mu:{"mouseup":gui.sendEventXY},
	kd:{"keydown":function(e){if(!e.repeat)this._item._event('kd',e.key)}},
    ku:{"keyup":function(e){if(!e.repeat)this._item._event('ku',e.key)}},
	k:{"keypress":function(e){this._item._event('k',e.key)}}
};
gui.Item.prototype._event=function(key,val){	//todo: check how this works for boundary crossing
	if(this._allprop.on[key].length){
		for(var filter of this._allprop.on[key]){
			if(val==filter)this._sendMsg({[key]:val});
		}
	}else{
		this._sendMsg({[key]:val});
	}
}
gui.Item.prototype.on=function(v){
	if(v && typeof(v)==='object'){
		for(var e in v){
			if(e==='o'){
				setTimeout(()=>this._overlapChecking(),10);
			}else if(gui.EVENTS[e]){
				for(var jsListener in gui.EVENTS[e]){
					if(v[e]){
						(this===gui.rootContainer?document.body:this._element).addEventListener(jsListener,gui.EVENTS[e][jsListener]);
					}else{
						(this===gui.rootContainer?document.body:this._element).removeEventListener(jsListener,gui.EVENTS[e][jsListener]);
					}
				}
			}else if(e in gui.INFO){
				if(v[e]){
					this._propWatch.add(e);
					gui.propWatch.add(this);
				}else{
					this._propWatch.delete(e);
				}
			}//todo: add animation watching
		}
	// }else{
		//todo! remove all listeners
	}
}
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// visual size and location options
addCSS(`
[x] , [y] {position:absolute;margin:0px}
[h] , [w] {border:solid 1px gray}
[C]:not([C='l']) {--rotate:0deg;--shiftX:0px;--shiftY:0px;transform:translateX(var(--shiftX)) translateY(var(--shiftY)) rotate(var(--rotate));transform-origin:center;}
[style~="left:"][cc="1"],[style~="left:"][cc="3"] {--shiftX:-50%}
[style~="right:"][cc="1"],[style~="right:"][cc="3"] {--shiftX:50%}
[style~="top:"][cc="2"],[style~="top:"][cc="3"] {--shiftY:-50%}
[style~="bottom:"][cc="2"],[style~="bottom:"][cc="3"] {--shiftY:50%}
[w]>.frame , [w]>.frame>.content , [w]>.frame.content {min-width:100%}
[h]>.frame , [h]>.frame>.content , [h]>.frame.content {min-height:100%}
`); //TODO? childPos overflow may compete with sx/sy functionality
gui.Item.prototype.w=function(v){
	v=this._getSize(v,this._getParentPw());
	this._element.style.width=v;
	// if(!this._parent._allprop.cw && !(this._allprop.bb&1) && gui.INFO.cw(this._parent)<(this._allprop.x+v))
		// this._parent.cw(this._allprop.x+v);
	// if(!this._allprop.iw)this._updateInternalWidth(v);
	// gui.updateInternalWidths();
	this._moveHook();
};
gui.Item.prototype.h=function(v){
	v=this._getSize(v,this._getParentPh());
	this._element.style.height=v;
	// console.log(this._getId(),gui.INFO.ch(this._parent),this._allprop.y+v);
	// if(!this._parent._allprop.ch && !(this._allprop.bb&2) && gui.INFO.ch(this._parent)<(this._allprop.y+v))
		// this._parent.ch(this._allprop.y+v);
	// if(!this._allprop.ih)this._updateInternalHeight(v);
	// gui.updateInternalHeights();
	this._moveHook();
};
gui.Item.prototype.cw=function(v){
	this._content.style.width=this._getSize(v,this._getPw());
	if(this._axisX)this._drawAxisX();
	// gui.updateInternalWidths();
}
gui.Item.prototype.ch=function(v){
	this._content.style.height=this._getSize(v,this._getPh());
	if(this._axisY)this._drawAxisY();
	// gui.updateInternalHeights();
}
gui.Bin.prototype.iw=function(v){
	this._updateInternalWidth();
	this._propWatch.add('w');
	gui.propWatch.add(this);
}
gui.Bin.prototype.ih=function(v){
	this._updateInternalHeight();
	this._propWatch.add('h');
	gui.propWatch.add(this);
}
gui.Item.prototype.sx=function(v){this._frame.scrollLeft=v<0?this._getSize(gui.INFO.cw(this)+v,this._getPw()):this._getSize(v,this._getPw());}
gui.Item.prototype.sy=function(v){this._frame.scrollTop=v<0?this._getSize(gui.INFO.ch(this)+v,this._getPh()):this._getSize(v,this._getPh());}
gui.Item.prototype.z=function(v){this._element.style.zIndex=v;};
gui.Item.prototype.rot=function(v){this._element.style.setProperty('--rotate',v+'deg');};
gui.Item.prototype.x=function(v,batch){
	if(this._allprop.bb&1)this._element.style.right=this._getSize(v,this._getParentPw());
	else this._element.style.left=this._getSize(v,this._getParentPw());
	if(!batch)this._moveHook();
};
gui.Item.prototype.y=function(v,batch){
	if(this._allprop.bb&2)this._element.style.bottom=this._getSize(v,this._getParentPh());
	else this._element.style.top=this._getSize(v,this._getParentPh());
	// if(!this._moveTriggers.y)this._moveTriggers.y=()=>{
		// var top=parseFloat(getComputedStyle(this._element.top));
		// var height=parseFloat(getComputedStyle(this._element.height));
		// if(this._parent
		// console.log(this);
		// // this._parent.ch();
	// };
	if(!batch)this._moveHook();
};
gui.Item.prototype.bb=function(v){
	if(v&1)this._element.style.left='';
	else this._element.style.right='';
	if(v&2)this._element.style.top='';
	else this._element.style.bottom='';
	if(this._allprop.x!==undefined)this.x(this._allprop.x);
	if(this._allprop.y!==undefined)this.y(this._allprop.y);
	this._moveHook();
}
gui.Item.prototype.cc=function(v){this._moveHook();}
gui.Item.prototype._getPw=function(){return this._pw||this._parent._getPw();}
gui.Item.prototype._getPh=function(){return this._ph||this._parent._getPh();}
gui.Item.prototype._getParentPw=function(){return this._parent?this._parent._getPw():1;}
gui.Item.prototype._getParentPh=function(){return this._parent?this._parent._getPh():1;}
gui.Item.prototype._updateInternalWidth=function(v){
	if(this._allprop.iw)this._pw=this._element.getBoundingClientRect().width/this._allprop.iw;
	//if(this._allprop.sx)this.sx(this._allprop.sx);
	if(this._allprop.cw)this.cw(this._allprop.cw);
}
gui.Item.prototype._updateInternalHeight=function(v){
	if(this._allprop.ih)this._ph=this._element.getBoundingClientRect().height/this._allprop.ih;
	//if(this._allprop.sy)this.sy(this._allprop.sy);
	if(this._allprop.ch)this.ch(this._allprop.ch);
}
gui.Bin.prototype._updateInternalWidth=function(v){
	if(this._allprop.iw)this._pw=this._element.getBoundingClientRect().width/this._allprop.iw;
	//if(this._allprop.sx)this.sx(this._allprop.sx);
	if(this._allprop.cw)this.cw(this._allprop.cw);
	if(this._axisX)this._drawAxisX();
	this._updateChildrenX();
}
gui.Bin.prototype._updateInternalHeight=function(v){
	if(this._allprop.ih)this._ph=this._element.getBoundingClientRect().height/this._allprop.ih;
	//if(this._allprop.sy)this.sy(this._allprop.sy);
	if(this._allprop.ch)this.ch(this._allprop.ch);
	if(this._axisY)this._drawAxisY();
	this._updateChildrenY();
}
gui.Bin.prototype._updateChildrenX=function(){
	for(var item of this){
		if(item._allprop.x!==undefined)
			item.x(item._allprop.x,true);								//update x
		if(item._allprop.w!==undefined){
			item._element.style.width=this._getPw()*item._allprop.w;	//update w
		}
		item._updateInternalWidth();
	}
}
gui.Bin.prototype._updateChildrenY=function(){
	for(var item of this){
		if(item._allprop.y!==undefined)
			item.y(item._allprop.y,true);								//update y
		if(item._allprop.h!==undefined){
			item._element.style.height=this._getPh()*item._allprop.h;	//update h
		}
		item._updateInternalHeight();
	}
}
gui.Item.prototype._getSize=function(v,dimensionP){
	if(v===null)return "";
	return v*(dimensionP||1);
}
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// emphasis options
addCSS(`
[shp] {text-align:center;border-width:1px;stroke-width:1px}
[shp='0'] {border-radius:0px !important}
[shp='1'] {border-radius:100% !important}
[shp^='['] {background-color:transparent !important;border-width:0px !important}
svg {width:100%;height:100%;left:0px;top:0px;position:absolute;z-index:0}
[str='-2'] {border-width:.5px;stroke-width:.5px;font-size:50%;opacity:0.8}
[str='-1'] {border-width:.5px;stroke-width:.5px;font-size:75%;opacity:0.9}
[str='1'] {border-width:3px;stroke-width:2px;font-weight:bold}
[str='2'] {border-width:4px;stroke-width:3px;font-weight:bold;text-decoration:underline;color:red}
[opq='0'] {background-color:transparent !important;fill:transparent !important;}
[opq='1'] {background-color:var(--color0);fill:var(--color0)}
.tag0 {background-color:hsl(0,50%,80%);fill:hsl(0,50%,80%)}
[opq='0'].tag0 {border-color:hsl(0,50%,80%);stroke:hsl(0,50%,80%)}
.tag1 {color:#46f}
.frame {text-decoration:inherit}
.content {text-decoration:inherit}
`);
gui.Item.prototype.shp=function(v){
	if(v.constructor===Array){
		var d='M'+v[0]+',0h'+v[1];					//horizontal line on top edge
		var shft=100-v[0]-v[1];
		var nxt=2;
		if(v[nxt]==='o'){
			d+='q'+shft+',0 ';
			nxt++;
		}else if(v[nxt]==='c'){
			d+='q0,'+v[++nxt]+' ';
		}else d+='l';
		d+=shft+','+v[nxt]+'v'+v[++nxt];			//vertical line on right edge
		shft=100-v[nxt-1]-v[nxt];
		if(v[++nxt]==='o'){
			d+='q0,'+shft+' ';
			nxt++;
		}else if(v[nxt]==='c'){
			d+='q-'+v[++nxt]+',0 ';
		}else d+='l';
		d+='-'+v[nxt]+','+shft+'h-'+v[++nxt];		//horizontal line on bottom edge
		shft=v[nxt-1]+v[nxt]-100;
		if(v[++nxt]==='o'){
			d+='q'+shft+',0 ';
			nxt++;
		}else if(v[nxt]==='c'){
			d+='q0,-'+v[++nxt]+' ';
		}else d+='l';
		d+=shft+',-'+v[nxt]+'v-'+v[++nxt];			//vertical line on left edge
		shft=v[nxt-1]+v[nxt]-100;
		if(v[++nxt]==='o'){
			d+='q0,'+shft+' ';
			nxt++;
		}else if(v[nxt]==='c'){
			d+='q'+v[0]+',0 ';
		}else d+='l';
		d+=v[0]+','+shft;
		if(!this._svg){
			this._svg=this._element.insertBefore(createSVG('svg'),this._element.children[0]);
			this._svg.setAttribute('viewBox','0 0 100 100');
			this._svg.setAttribute('preserveAspectRatio','none');
		}
		if(!this._path){
			this._path=this._svg.appendChild(createSVG('path'));
		}
		this._path.setAttribute('d',d);
		this._path.setAttribute('vector-effect','non-scaling-stroke');
	}else if(this._svg){
		this._element.removeChild(this._svg);
		delete this._svg;
		delete this._path;
	}
};
gui.Item.prototype.opq=function(v){};
gui.Item.prototype.str=function(v){}
gui.Item.prototype.tag=function(v){
	this._element.className='';
	if(this._element===this._content)this._element.classList.add('content');
	if(this._element===this._frame)this._element.classList.add('frame');
	if(this._element===this._title)this._element.classList.add('title');
	if(v && v.length){
		for(var tag of v){
			if(tag!==null)
				this._element.classList.add(tag.constructor===String?tag:('tag'+tag));
		}
	}
}
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// additional bin options
gui.Bin.prototype._default=function(propName,propVal){
	if(propVal===null){
		if(propName in this._parent._defaults)
			propVal=this._defaults[propName]=this._parent._defaults[propName];
		else
			delete this._defaults[propName];
	}else{
		this._defaults[propName]=propVal;
	}
	for(var child of this){
		if(!(propName in child._prop && propName!='C')){
			child._refreshProp(propName,propVal);
		}
		if(child.df && !(propName in child._defaults))
			child._default(propName,propVal);
	}
}
gui.Bin.prototype.df=function(v){
	if(v===null){
		v={};
		for(var propName in this._defaults)this._default(propName,null);
	}else
		for(var propName in v)this._default(propName,v[propName]);
}
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// additional button options
gui.Btn.prototype.in=function(v){
	if(v){
		this._setAttr('tabindex',0);
	}else{
		this._setAttr('tabindex',null);
	}
}
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// hot keys
gui.Item.prototype.keys=function(v){
	if(v==null || v.length==0){
		for(var k of this._allprop.keys)
			if(gui.keys[k]==this)
				delete gui.keys[k];
		if(Object.keys(gui.keys).length==0){
			window.removeEventListener('keydown',gui.keyCheck);
			window.removeEventListener('keyup',gui.keyCheck);
		}
	}else{
		if(Object.keys(gui.keys).length==0){
			window.addEventListener('keydown',gui.keyCheck);
			window.addEventListener('keyup',gui.keyCheck);
		}
		for(var k of v)
			gui.keys[k]=this;
	}
}
gui.keys={};
gui.keyCheck=function(e){
	if(!e.repeat){
		var item=gui.keys[e.key];
		if(item && !(e.target.isContentEditable && e.target._item.in>0)){
			if(document.body.contains(item._element)){
				e.preventDefault();
				e.stopPropagation();
				if(e.type==='keydown'){
					if(item._allprop.fold===2){			//fold
						item._updateProp('fold',1);
					}else if(item._allprop.fold===1){	//unfold
						item._updateProp('fold',2);
					}else if(item._allprop.in===1){ 	//focus
						//todo: add focus
						if(item._btnDown)item._btnDown();
					}
				}else if(e.type==='keyup' && item._btnUp){
					item._btnUp();
				}
			}else{
				delete gui.keys[e.key];
				if(Object.keys(gui.keys).length===0){
					window.removeEventListener('keydown',gui.keyCheck);
					window.removeEventListener('keyup',gui.keyCheck);
				}
			}
		}
	}
}
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// additional text options
addCSS(`
[contenteditable] {background-color:white;min-width:100px;max-height:10em;padding-left:5px;padding-right:5px;border:solid 1px lightgray;font-family:monospace;pointer-events:all}
`);
gui.Txt.prototype.in=function(v){
	var item=this,c=this._content;
	c._removeListeners();
	if(v){
		c.setAttribute('contenteditable','plaintext-only');
		var oneline=!(c.innerText.includes('\n')||c.innerText.includes('\r'));
		var lastVal=item._allprop.v;
		function send(){
			if(lastVal!==item._prop.v){
				item._sendMsg({v:item._prop.v});
				lastVal=item._prop.v;
			}
			// if(item._allprop.v!=c.innerText){
				// item._allprop.v=item._prop.v=c.innerText;
				// item._sendMsg({v:c.innerText});
			// }
			// item._sendIfNew('v',item._allprop.v);
		}
		c._listen('input',function(e){
			if(oneline&&(c.innerText.includes('\n')||c.innerText.includes('\r')))
				c.innerHTML=c.innerText.replace(/\n|\r/g,' ');
			item._allprop.v=item._prop.v=c.innerText;
			// if(this.v==2)send();
		});
		c._listen('blur',send);
		if(oneline)
			c._listen('keypress',(e)=>{if(e.keyCode==13){e.preventDefault();send();}});
	}else{
		c.removeAttribute('contenteditable');
	}
};
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// additional number options
addCSS(`
[C='num'][unit]:not([unit='$']):not([unit^=':']):after {content: attr(unit);font-size:80%;padding-left:2px}
[C='num'][unit='$']>.content:before {content: "$";font-size:70%;padding:.5em 0 0 0}
`);
gui.numdisplay=function(v,rnd,offset,unit){
	if(rnd)v=offset+Math.round2(v-offset,rnd);
	if(unit&&unit.startsWith(':'))v=new Date(v*1000).format(unit||"YMDhms");
	else if(rnd<1)v=v.toFixed(rnd.toString().split('.')[1].length);
	return v;
}
gui.Num.prototype.in=function(v){
	var c=this._content;
	c._removeListeners();
	if(v>0){
		c.setAttribute('contenteditable','plaintext-only');
		c._listen('paste',(e)=>{
			e.preventDefault();
			var v=parseFloat(e.clipboardData.getData("text/plain"));
			if(!isNaN(v))
				document.execCommand("insertText", false, v);
		});
		function send(){
			if(c.innerText!=c._item._allprop.v){
				c._item._updateProp('v',parseFloat(c.innerText));
				c._item._sendMsg({v:c._item._allprop.v});
			}
		}
		c._listen('blur',send);
		c._listen('keypress',(e)=>{
			if(e.keyCode==13){
				e.preventDefault();
				send();
			}else if(e.key && !'0123456789e.-'.includes(e.key)){
				e.preventDefault();
			}
		});
	}else{
		c.removeAttribute('contenteditable');
	}
};
gui.Num.prototype.unit=function(v){this.v(this._allprop.v);};
gui.Num.prototype.max=function(v){this.v(this._allprop.v);};
gui.Num.prototype.min=function(v){this.v(this._allprop.v);};
gui.Num.prototype.rnd=function(v){this.v(this._allprop.v);};
gui.Num.prototype.v=function(v){
	// if(!v)v=0;
	if(this._allprop.min!==undefined)v=Math.max(v,this._allprop.min);
	if(this._allprop.max!==undefined)v=Math.min(v,this._allprop.max);
	this._content.innerHTML=gui.numdisplay(v,this._allprop.rnd,this._allprop.min||0,this._allprop.unit);
}
gui.Num.prototype._typeDefaults={v:0};
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// holddown button
addCSS(`
[C='hold']:active {background-color:var(--colorTrue) !important;}
[C='hold'] {text-align:center;display:inline-block;padding:.4em;color:var(--color1);border:1px solid rgba(0,0,0,0.2);background-color:var(--colorFalse);box-shadow: 0 0 5px -1px rgba(0,0,0,0.2);vertical-align:middle;}
[C='hold']:not(:empty),[select="0"]:not(:empty) {min-width:100px;border-radius:4px;}
[C='hold'][in]:empty {width:2em;height:2em;border-radius:2em;}
`)
gui.Hold=class extends gui.Btn{
	_btnDown(){this._boundTo._element.onmousedown();}
	_btnUp(){this._boundTo._element.onmouseup();}
	_bind(item){
		var thisItem=this;
		this._boundTo=item;
		if(this._unbind)this._unbind();
		if(this._allprop)
			item._setAttr('in',this._allprop.in);
		item._element.onmousedown=function(){						//onmousedown behavior
			thisItem._updateProp('v',true);
			thisItem._sendMsg({v:true});
		}
		item._element.onmouseup=function(){							//onmouseup behavior
			thisItem._updateProp('v',false);
			thisItem._sendMsg({v:false});
		}
		this._unbind=function(){item._element.onmousedown=item._element.onmouseup=null;}
	}
	v(v){}
}
gui.Hold.prototype.C='hold';
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// selectable options (checkboxes/radiobuttons)
addCSS(`
[C='select'] {display:block;text-align:center}
[C='select'] > .title {display:inline-block}
[C='select']:not([v="true"]):before {content:"\\2610" " ";display:inline}
[C='select'][v="true"]:before {content:"\\2611" " ";display:inline}
[C='select'][group]:not([v="true"]):before {content:"\\029be" " ";display:inline}
[C='select'][group][v="true"]:before {content:"\\029bf" " ";display:inline}
`)
gui.Select=class extends gui.Btn{
	_bind(item){
		var thisItem=this;
		this._boundTo=item;
		if(this._unbind)this._unbind();
		if(this._allprop)
			item._setAttr('in',this._allprop.in);
		// this._boundTo._setAttr('tabindex','0');
		item._element.onclick=function(){							//select/deselect behavior
			if(thisItem._allprop.v){
				thisItem._sendMsg({v:false});
				thisItem._updateProp('v',false);
				// item._setAttr("v","false");
			}else{
				thisItem._sendMsg({v:true});
				thisItem._updateProp('v',true);
				// item._setAttr("v","true");
			}
		}
		this._unbind=function(){item._element.onclick=null;}
	}
	title(v){
		super.title(v);
		if((v===null||v===undefined)?this._prop.id:v)this._element.style.textAlign='left';
		else this._element.style.textAlign='center';
	}
	v(v){
		if(this._boundTo && this._boundTo!==this){
			this._boundTo._setAttr('v',v);
		}
		var group=this._allprop.group;
		if(group){
			var currentSelected=gui.selectGroups[group];
			if(v){
				if(currentSelected && currentSelected!==this){
					currentSelected._updateProp('v',false);
					// if(currentSelected._boundTo!==currentSelected)
						// currentSelected._boundTo._setAttr('v',null);
				}
				gui.selectGroups[group]=this;
			}else if(currentSelected===this){
				gui.selectGroups[group]=undefined;
			}
		}
	}
	group(v){
		//this._setAttr('group',v);
	}
}
gui.Select.prototype.C='select';
gui.selectGroups={};
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// html
addCSS(`
[C='html'] > .title:not(empty) {border-bottom:solid 1px var(--colorBorder);width:25%;}
[C='html'] > .content {white-space:normal;}
`);
gui.Html=class extends gui.Txt{
	v(v){this.in(this._allprop.in);}
	in(v){
		if(v>0){
			this._content.innerText=this._allprop.v;
			gui.Txt.prototype.in.call(this,v);
		}else if(this._content.getAttribute('contenteditable')){
			this._content.removeAttribute('contenteditable');
			this._content.innerHTML=this._allprop.v;
		}
	}
}
gui.Html.prototype.C='html';
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// url
// addCSS(`
// [C='url'] {cursor:pointer;color:var(--colorLink)}
// [C='url'] > .title:not(empty) {border-bottom:solid 1px var(--colorLink);}
// [C='url'] > .content {display:none;}
// `);
// gui.Url=class extends gui.Txt{
	// v(v){
		// this._element.onclick=()=>open(v);
		// this.title();
	// }
	// title(v){this._title.innerText=(v===null||v===undefined)?(this._prop.id?this._prop.id:this._allprop.v):v;}
// }
// gui.Url.prototype.C='url';
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// file
addCSS(`
[C='file'] > .content > {font-size:80%}
[C='file']:not([v]) {display:none} 
[C='file'] > .content {margin-left:1em;white-space:normal}
`);
gui.File=class extends gui.Txt{
	v(v){setTimeout(()=>this.title(),10)}
	title(v){
		if(this._allprop.v){
			if(!this._link){
				this._title.innerHTML='';
				this._link=this._title.appendChild(document.createElement("a"));
			}
			var filename=this._allprop.title||this._prop.id||('download.'+(this._allprop.filetype||'txt'));
			var file=new Blob([this._allprop.v]);
			this._link.href=URL.createObjectURL(file);
			this._link.download=filename;
			var size=this._allprop.v.length>1048576?
				(this._allprop.v.length/1048576).toFixed(1)+'mb':
				(this._allprop.v.length>1024?
					(this._allprop.v.length/1024).toFixed(1)+'kb':
					this._allprop.v.length+'b');
			this._link.innerText=`${filename} (${size}) ⤓`;
		}
	}
	filetype(v){
		if(v.toLowerCase()=='csv'){
			load([
					'https://cdnjs.cloudflare.com/ajax/libs/dygraph/2.1.0/dygraph.min.js',
					'https://cdnjs.cloudflare.com/ajax/libs/dygraph/2.1.0/dygraph.css'
				],()=>{
					if(!this._previewBtn){
						this._previewBtn=this._content.appendChild(document.createElement("a"));
						this._previewBtn.innerText='Preview';
						this._preview=this._content.appendChild(document.createElement("div"));
					}
					var thisItem=this;
					this._previewBtn.onclick=function(){
						if(thisItem._graph){
							delete thisItem._graph;
							thisItem._content.removeChild(thisItem._preview);
							thisItem._preview=thisItem._content.appendChild(document.createElement("div"));
						}else{
							thisItem._preview.style.backgroundColor='white';
							thisItem._preview.style.color='black';
							thisItem._preview.style.margin='1em';
							thisItem._preview.style.overflow='visible';
							thisItem._graph=new Dygraph(thisItem._preview,
								thisItem._allprop.v,
								{
									legend: 'always',
									animatedZooms: true,
									drawPoints: true,
									title: thisItem._allprop.title||thisItem._prop.id||'',
									connectSeparatedPoints: true
								});
						}
					}
				});
		}else if(this._previewBtn){
			this._content.removeChild(this._previewBtn);
			delete this._previewBtn;
			this._content.removeChild(this._preview);
			delete this._preview;
		}
	}
}
gui.File.prototype.C='file';
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// mkdn
addCSS(`
[C='mkdn'] > .title:not(empty) {border-bottom:solid 1px var(--colorBorder);width:25%;}
`);
gui.Mkdn=class extends gui.Html{
	v(v){this.in(this._allprop.in);}
	in(v){
		if(v>0){
			this._content.innerText=this._allprop.v;
			gui.Txt.prototype.in.call(this,v);
		}else if(this._content.getAttribute('contenteditable')){
			this._content.removeAttribute('contenteditable');
			this._content.innerHTML=gui.markdown(this._allprop.v);
		}
	}
}
gui.Mkdn.prototype.C='mkdn';
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// popup
addCSS(`
[C='popup'] {position:fixed;top:0px;left:0px;width:100vw;height:100vh;z-index:99999;background-color:rgba(255,255,255,.5);pointer-events:all}
[C='popup'] > div {top:50%;left:50%;transform:translate(-50%,-50%);width:50%;max-width:90vw;max-height:90vh;overflow:auto;border:solid 1px gray;border-radius:4px;padding:1em;background-color:var(--color0)}
[C='popup'] > * > .title:empty {width:0px;height:0px;overflow:hidden}
[C='popup'] > * > .title:not(empty) {border-bottom:solid 1px var(--colorBorder);width:25%;}
`);
gui.Popup=class extends gui.Bin{
	_initContent(){
		this._element=document.createElement('div'); //screen
		this._frame=this._element.appendChild(document.createElement('div')); //popup window
		this._title=this._frame.appendChild(document.createElement('div'));
		this._content=this._frame.appendChild(document.createElement('div'));
		// this._content.style.overflow='auto';
		this._parent._placeChildElement(this);
	}
}
gui.Popup.prototype.C='popup';
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// one (tabs)
gui.One=class extends gui.Bin{
	//todo: every child must have "fold" option
}
gui.One.prototype.C='one';
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// toast
addCSS(`
[C='toast'] {max-height:95%;overflow-y:auto;padding-right:1em;position:fixed;bottom:3px;right:3px;z-index:100;pointer-events:all;background-color:var(--color1);color:var(--color0);}
[C='toast'] [id='closeBtn'] {right:0px;top:0px;position:absolute;cursor:pointer}
[C='toast'] [id='closeBtn']::before {content:'x';color:#fff;font-weight:300;font-family:Arial,sans-serif;padding:4px}
`);
gui.Toast=class extends gui.Bin{
	_initContent(){
		super._initContent();
		this._closeBtn=this._element.appendChild(document.createElement('div'));
		this._closeBtn.setAttribute('id','closeBtn');
		var thisItem=this;
		this._closeBtn.onclick=()=>thisItem._parent._removeChild(thisItem);
	}
}
gui.Toast.prototype.C='toast';
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// table
addCSS(`
[C="table"] > .title:not(empty) {border-bottom:solid 1px var(--colorBorder);width:25%;overflow:visible;flex:none}
[C="table"] {display:flex;flex-direction:column}
[C="table"] > div {overflow:auto;flex:1 1 auto}
[C="tableRow"] {margin:0}
table {border-spacing:0;border-collapse:collapse;}
[head="1"] > div > table > tr:first-child > * {font-weight:bold;background:var(--colorHead);z-index:2;position:relative}
td.title:empty {display:table-cell}
table {font-size:96%}
tr {font-size:96%}
td {font-size:96%;position:relative}
`);
gui.Table=class extends gui.Bin{
	_initContent(){
		this._element=document.createElement('div');
		this._title=this._element.appendChild(document.createElement('div'));
		this._frame=this._element.appendChild(document.createElement('div'));
		this._frame.style.overflow='auto';
		this._content=this._frame.appendChild(document.createElement('table'));
		this._parent._placeChildElement(this);
	}
	_newChild(prop){
		var type=gui.getType(prop);
		if(!type || type==gui.Bin){
			var child=new gui.TableRow(prop,this);
			this._children.push(child);
			// if(typeof(prop.id)!=='number')this._childmap[prop.id]=child;
		}
	}
	_floatRow(e){
		var translate=this.scrollTop?"translate(0,"+(this.scrollTop-3)+"px)":null;
		var p=this.firstChild.firstChild.querySelectorAll('td');
		for(var i in p)if(p[i] && p[i].style){
			p[i].style.transform = translate;
		}
	}
	head(v){
		if(v)this._frame.addEventListener('scroll',this._floatRow);
		else{
			this._content.firstChild.style.transform=null;
			this._frame.removeEventListener('scroll',this._floatRow);
		}
	}
}
gui.Table.prototype.C='table';
gui.TableRow=class extends gui.Bin{
	_initContent(){
		this._element=document.createElement('tr');				//e.v is a sub-element where content is displayed
		this._frame=this._element;
		this._title=this._element.appendChild(document.createElement('td'));
		this._content=this._element;
		this._parent._placeChildElement(this);
	}
	_placeChildElement(child){
		var td=this._content.appendChild(document.createElement('td'));
		td.appendChild(child._element);
		child._outterElement=td;
	}
}
gui.TableRow.prototype.C='tableRow';
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// ln (link between items)
addCSS(` 
svg {width:100%;height:100%;left:0px;top:0px;position:absolute;z-index:0}
[C='l']>.title {stroke:none;fill:currentColor;font-size:90%;font-family:sans-serif;}
`);
gui.getMarker=function(markerType,color){
	var id;
	if(markerType==='arrow' || markerType==='dot'){
		id='marker.'+markerType+'.'+color;
		if(!document.getElementById(id)){
			var d;
			if(!gui.svgdefs){
				gui.svgdefs=document.body.appendChild(createSVG('svg')).appendChild(createSVG('defs'));
				gui.svgdefs.parentElement.style.height='0px';
			}
			var m=gui.svgdefs.appendChild(createSVG('marker'));
			m.id=id;
			m.setAttribute('orient','auto-start-reverse');
			m.setAttribute('markerUnits','strokeWidth');
			if(markerType==='arrow'){
				m.setAttribute('viewBox','0 0 10 10');
				m.setAttribute('refX','9');
				m.setAttribute('refY','5');
				m.setAttribute('markerWidth','10');
				m.setAttribute('markerHeight','8');
				d=m.appendChild(createSVG('path'));
				d.setAttribute('d',"M 0 0 L 10 5 L 0 10 z");
			}else{
				m.setAttribute('refX','2');
				m.setAttribute('refY','2');
				m.setAttribute('markerWidth','5');
				m.setAttribute('markerHeight','5');
				d=m.appendChild(createSVG('circle'));
				d.setAttribute('cx','2');
				d.setAttribute('cy','2');
				d.setAttribute('r','1.1');
			}
			d.setAttribute('fill',gui.color(color)); //TODO: fix this color
		}
		id='url(#'+id+')';
	}
	return id;
}
gui.L=class extends gui.Item{
	_initContent(){
		if(!this._parent._svg)
			this._parent._svg=this._svg=this._parent._content.insertBefore(createSVG('svg'),this._parent._content.childNodes[0]);
		else
			this._svg=this._parent._svg;
		// this._svg=this._content.appendChild(createSVG('svg'));
		this._path=this._svg.appendChild(createSVG('g'));
		// this._path.setAttribute('C','l');
		this._path.setAttribute('stroke-width','2');
		this._path.setAttribute('fill','none');
		this._paths=[this._path.appendChild(createSVG('path'))];
		this._element=document.createElement('div');									//element container (overflow:visible so that shapes/axes can show)
		this._parent._placeChildElement(this); //todo: if this is commented out, need a diff way to go through children
		this._content=this._frame=this._element=this._path;
		this._title=this._path.appendChild(createSVG('text'));
		this._title.style.display='none';
		// this._outterElement=this._parent._svg;
		this._redraw();
		this._path.onmouseenter=e=>{
			this._title.style.display='block';
			var r=this._parent._content.getBoundingClientRect();
			this._title.setAttribute('x',2+e.clientX-r.left);
			this._title.setAttribute('y',2+e.clientY-r.top);
			// this._title.style.top=2+e.clientY-r.top;
		}
		this._path.onmouseleave=e=>{
			this._title.style.display='none';
		}
		this._uids=[];
	}
	_beforeRemove(){
		this._parent._svg.removeChild(this._path);
	}
	_drawPaths(){
		var startMarker,endMarker;
		if(this._allprop.dir==1){
			startMarker=gui.getMarker('dot',this._allprop.lc);
			endMarker=gui.getMarker('arrow',this._allprop.lc);
		}else if(this._allprop.dir==2){
			startMarker=gui.getMarker('arrow',this._allprop.lc);
			endMarker=gui.getMarker('arrow',this._allprop.lc);
		}else if(this._allprop.dir==-1){
			startMarker=gui.getMarker('arrow',this._allprop.lc);
			endMarker=gui.getMarker('dot',this._allprop.lc);
		}
		var i=0,r1,r2,d,svgr=this._svg.getBoundingClientRect();
		for(var e of this._elements){
			if(e._item){
				if(r1){
					if(!this._paths[i])
						this._paths[i]=this._path.appendChild(createSVG('path'));
					r2=e.getBoundingClientRect();
					if(r1.right<r2.left) //r1 is left of r2
						if(r1.bottom<r2.top) //r1 is above of r2
							d=[r1.right-svgr.left,r1.bottom-svgr.top,r2.left-svgr.left,r2.top-svgr.top];
						else if(r2.bottom<r1.top) //r2 is above of r1
							d=[r1.right-svgr.left,r1.top-svgr.top,r2.left-svgr.left,r2.bottom-svgr.top];
						else
							d=[r1.right-svgr.left,r1.top+r1.height/2-svgr.top,r2.left-svgr.left,r2.top+r2.height/2-svgr.top];
					else if(r2.right<r1.left) //r2 is left of r1
						if(r1.bottom<r2.top) //r1 is above of r2
							d=[r1.left-svgr.left,r1.bottom-svgr.top,r2.right-svgr.left,r2.top-svgr.top];
						else if(r2.bottom<r1.top) //r2 is above of r1
							d=[r1.left-svgr.left,r1.top-svgr.top,r2.right-svgr.left,r2.bottom-svgr.top];
						else
							d=[r1.left-svgr.left,r1.top+r1.height/2-svgr.top,r2.right-svgr.left,r2.top+r2.height/2-svgr.top];
					else if(r1.bottom<r2.top) //r1 is above of r2
						d=[r1.left+r1.width/2-svgr.left,r1.bottom-svgr.top,r2.left+r2.width/2-svgr.left,r2.top-svgr.top];
					else if(r2.bottom<r1.top) //r2 is above of r1
						d=[r1.left+r1.width/2-svgr.left,r1.top-svgr.top,r2.left+r2.width/2-svgr.left,r2.bottom-svgr.top];
					else if(r2.right<r1.right) //r2 is left of r1, but overlapping
						if(r2.top<r1.top) //r2 is above of r1
							d=[r1.right-svgr.left,r1.top-svgr.top,r2.right-svgr.left,r2.top-svgr.top];
						else if(r2.bottom>r1.bottom) //r1 is above of r2
							d=[r1.right-svgr.left,r1.bottom-svgr.top,r2.right-svgr.left,r2.bottom-svgr.top];
						else
							d=[r1.right-svgr.left,r1.top+r1.height/2-svgr.top,r2.right-svgr.left,r2.top+r2.height/2-svgr.top];
					else if(r2.left>r1.left) //r2 is right of r1, but overlapping
						if(r2.top<r1.top) //r1 is above of r2
							d=[r1.left-svgr.left,r1.top-svgr.top,r2.left-svgr.left,r2.top-svgr.top];
						else if(r2.bottom>r1.bottom) //r2 is above of r1
							d=[r1.left-svgr.left,r1.bottom-svgr.top,r2.left-svgr.left,r2.bottom-svgr.top];
						else
							d=[r1.left-svgr.left,r1.top+r1.height/2-svgr.top,r2.left-svgr.left,r2.top+r2.height/2-svgr.top];
					else
						d=[r1.right-svgr.left,r1.top+r1.height/2-svgr.top,r2.right-svgr.left,r2.top+r2.height/2-svgr.top];
					this._paths[i].setAttribute('d','M'+d);
					this._paths[i].setAttribute('marker-start',startMarker);
					this._paths[i].setAttribute('marker-end',endMarker);
					r1=r2;
					i++;
				}else{
					r1=e.getBoundingClientRect();
				}
			}
		}
		this._paths.length=i;
	}
	_drawPath(){
		//collect elements
		if(this._elements)
			for(var element of this._elements)
				delete element._item._moveTriggers.ln;
		this._elements=[];
		if(this._uids.length){
			for(var uid of this._uids){
				var item=this._parent._searchId(uid.constructor===Array?uid:[uid]);
				if(item)this._elements.push(item._element);
			}
		}else if(this._allprop.tag){
			for(var element of this._parent._content.children)
				if(element._item && element._item!==this)
					for(var tag of this._allprop.tag)
						if(element._item._allprop.tag.includes(tag))
							this._elements.push(element);
		}else{
			for(var element of this._parent._content.children)
				if(element._item && element._item!==this)
					this._elements.push(element);
		}
		for(var element of this._elements)
			element._item._moveTriggers.ln=()=>{this._redraw()};
		//connect elements
		if(this._allprop.dir){
			this._drawPaths();
		}else{
			if(this._paths.length){
				for(var i=1;i<this._paths.length;i++)
					this._paths[i].remove();
				this._paths.length=1;
			}else{
				this._paths[0]=this._path.appendChild(createSVG('path'));
			}
			var r,svgr=this._svg.getBoundingClientRect(),d='M';
			for(var e of this._elements){
				r=e.getBoundingClientRect();
				d+=(r.left+r.width/2-svgr.left)+','+(r.top+r.height/2-svgr.top)+' ';
				// if(getComputedStyle(e).position!=='absolute'){
					// var x=e.offsetLeft+e.offsetWidth/2;
					// if(d)d+=x+','+e.offsetTop+' ';
					// if(e.nextElementSibling)d+='M'+x+','+(e.offsetTop+e.offsetHeight)+' ';
				// }else{
					// if(!d)d='M';
					// d+=e.offsetLeft+','+e.offsetTop+' ';
				// }
			}
			this._paths[0].setAttribute('d',d);
			this._paths[0].removeAttribute('marker-start');
			this._paths[0].removeAttribute('marker-end');
		}
	}
	_redraw(){
		if(!this._drawing)
			this._drawing=setTimeout(()=>{this._drawPath();this._drawing=null;},15);
	}
	_updateInternalWidth(v){this._redraw()};
	_updateInternalHeight(v){this._redraw()};
	v(v){
		if(v.constructor===Array){
			if(v[0]===null)this._uids=[];
			for(var uid of v){
				if(uid!==null)
					this._uids.push(uid);
			}
		}else{
			this._uids=[];
		}
		this._redraw();
	}
	tag(v){
		this._element.classList.remove(...this._element.classList);
		this._element.classList.add('content','frame');
		if(v && v.length){
			for(var tag of v){
				if(tag!==null)
					this._element.classList.add(tag.constructor===String?tag:('tag'+tag));
			}
		}
		this._redraw();
	}
	dir(v){this._redraw();}
}
gui.L.prototype.C='l';
gui.L.prototype.shp=null;
gui.L.prototype.opq=null;
gui.L.prototype.w=null;
gui.L.prototype.h=null;
gui.L.prototype.iw=null;
gui.L.prototype.ih=null;
gui.L.prototype.x=null;
gui.L.prototype.y=null;
gui.L.prototype.rot=null;
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// axisX & axisY
addCSS(`
[axisx] {margin-bottom:2.5em;overflow:visible}
.axisX {height:2.5em;border:none;left:0px;top:100%;width:100%;position:absolute;margin:0px;overflow:visible;border-top:solid 1px gray}
.axisXmarker {position:absolute;font-size:10px;top:3px;margin:0px;border:none;padding:0px}
.axisXmarker[style~="left:"] {transform:translateX(-50%)}
.axisXmarker[style~="right:"] {transform:translateX(50%)}
.axisXmarker:before {content:'';width:1px;height:7px;background:#444;position:absolute;bottom:100%;left:50%;margin:0px;border:none;padding:0px;margin-left:-0.5px}
.axisX > .title {text-align:center;position:relative;margin-top:1em;width:100%;font-size:10pt}
[axisy] {margin-left:4em;margin-top:1em;overflow:visible}
.axisY {border:none;right:100%;top:0;height:100%;position:absolute;overflow:visible;width:1.1em;margin:0px;border-right:solid 1px gray}
.axisYmarker {position:absolute;font-size:8px;right:4px;margin:0px;border:none;padding:0px}
.axisYmarker[style~="top:"] {transform:translateY(-50%)}
.axisYmarker[style~="bottom:"] {transform:translateY(50%)}
.axisYmarker:after {content:'';height:1px;width:7px;background:#444;position:absolute;right:-8px;top:50%;margin:0px;border:none;padding:0px;margin-top:-0.5px}
.axisY > .title {right:100%;text-align:center;height:100%;writing-mode:vertical-rl;transform:rotate(180deg);font-size:10pt}
`);
gui.scrollAxisX=function(e){this._item._axisX.scrollLeft=this.scrollLeft;};
gui.scrollAxisY=function(e){this._item._axisY.scrollTop=this.scrollTop;};
gui.Bin.prototype._getAxisValuesOffsets=function(axis,cw,w){
	var offset=axis.x||axis.y;
	var axisSize=Math.max(cw,w);
	if(axis.v){
		if(offset){												//yes values, yes offset
			return [axis.v,offset];
		}else{													//yes values, no offset
			offset=[];
			for(var i=0;i<axis.v.length;i++)
				offset[i]=i*axisSize/(axis.v.length-1);
			return [axis.v,offset];
		}
	}
	var values=[];
	if(('min' in axis) && ('max' in axis) && (axis.min<axis.max)){
		var range=axis.max-axis.min;
		if(offset){												//no values, yes offset, yes min/max
			for(var i=0;i<offset.length;i++){
				values[i]=axis.min+(range*offset[i]/axisSize);
			}
		}else{													//no values, no offset, yes min/max
			offset=[];
			for(var val=axis.min;val<=axis.max;val+=(axis.rnd||(range/10))){
				values.push(val);
				offset.push((val-axis.min)*axisSize/range);
			}
		}
	}else if(offset){											//no values, yes offset, no min/max
		for(var i=0;i<offset.length;i++){
			values[i]=offset[i];
		}
	}else{														//no values, no offset, no min/max
		offset=[];
		for(var val=0;val<axisSize;val+=(axis.rnd||((w||cw)/10))){
			values.push(val);
			offset.push(val);
		}
	}
	if(!offset.includes(axisSize)){
		values.push('');
		offset.push(axisSize);
	}
	return [values,offset];
}
gui.Bin.prototype._drawAxisX=function(){
	//remove old markers
	for(var i=this._axisX.children.length;i--;){
		if(this._axisX.children[i].className==='axisXmarker')
			this._axisX.children[i].remove();
	}
	//automatically fill in missing coordinates or values
	var axisProps=this._allprop.axisx;
	var axis=this._getAxisValuesOffsets(axisProps,gui.INFO.cw(this),this._allprop.iw||this._allprop.w||0);
	//add new markers
	for(var i=0;i<axis[0].length;i++){
		var d=this._axisX.appendChild(document.createElement('div'));
		d.setAttribute('class','axisXmarker');
		if(axis[0][i].constructor===String)d.innerHTML=axis[0][i];
		else d.innerHTML=gui.numdisplay(axis[0][i],axisProps.rnd,axisProps.min||0,axisProps.unit);
		if(axisProps.bb===1)d.style.right=this._getSize(axis[1][i],this._getPw());
		else d.style.left=this._getSize(axis[1][i],this._getPw());
	}
	//scroll functionality
	if(this._scrollAxisX){
		if(this._frame.offsetWidth>=this._frame.scrollWidth){
			this._scrollAxisX=false;
			this._axisX.style.overflow='visible';
			this._frame.removeEventListener('scroll',gui.scrollAxisX);
		}
	}else if(this._frame.offsetWidth<this._frame.scrollWidth){
		this._scrollAxisX=true;
		this._axisX.style.overflow='hidden';
		this._frame.addEventListener('scroll',gui.scrollAxisX);
	}
}
gui.Bin.prototype._drawAxisY=function(){
	//remove old markers
	for(var i=this._axisY.children.length;i--;){
		if(this._axisY.children[i].className==='axisYmarker')
			this._axisY.children[i].remove();
	}
	//automatically fill in missing coordinates or values
	var axisProps=this._allprop.axisy;
	var axis=this._getAxisValuesOffsets(axisProps,gui.INFO.ch(this),this._allprop.ih||this._allprop.h||0);
	//add new markers
	for(var i=0;i<axis[0].length;i++){
		var d=this._axisY.appendChild(document.createElement('div'));
		d.setAttribute('class','axisYmarker');
		if(axis[0][i].constructor===String)d.innerHTML=axis[0][i];
		else d.innerHTML=gui.numdisplay(axis[0][i],axisProps.rnd,axisProps.min||0,axisProps.unit);
		if(axisProps.bb===0)d.style.top=this._getSize(axis[1][i],this._getPh());
		else d.style.bottom=this._getSize(axis[1][i],this._getPh());
	}
	//scroll functionality
	if(this._scrollAxisY){
		if(this._frame.offsetHeight>=this._frame.scrollHeight){
			this._scrollAxisY=false;
			this._axisY.style.overflow='visible';
			this._frame.removeEventListener('scroll',gui.scrollAxisY);
		}
	}else if(this._frame.offsetHeight<this._frame.scrollHeight){
		this._scrollAxisY=true;
		this._axisY.style.overflow='hidden';
		this._frame.addEventListener('scroll',gui.scrollAxisY);
	}
}
gui.Bin.prototype.axisx=function(v){
	if(v===null && this._axisX){
		this._axisX.remove();
		delete this._axisX;
		delete this._moveTriggers.axisx;
	}else if(v.constructor===Object){
		if(!this._axisX){
			this._axisX=this._element.appendChild(document.createElement('div'));
			this._axisX.setAttribute('class','axisX');
		}
		if(('title' in v) || ('unit' in v)){
			var title=v.title||'';
			if(v.unit && v.unit[0]!==':')title=title+' ('+v.unit+')';
			if(title){
				if(!this._axisX._title){
					this._axisX._title=this._axisX.appendChild(document.createElement('div'));
					this._axisX._title.setAttribute('class','title');
				}
				this._axisX._title.innerHTML=title;
			}else if(this._axisX._title){
				this._axisX._title.remove();
			}
		}
		if('x' in v || 'v' in v || 'max' in v || 'min' in v || 'step' in v || 'rnd' in v || 'unit' in v || 'bb' in v)
			setTimeout(()=>this._drawAxisX(),5);
		this._moveTriggers.axisx=()=>{this._drawAxisX()};
	}
}
gui.Bin.prototype.axisy=function(v){
	if(v===null && this._axisY){
		this._axisY.remove();
		delete this._axisY;
		delete this._moveTriggers.axisy;
	}else if(v.constructor===Object){
		if(!this._axisY){
			this._axisY=this._element.appendChild(document.createElement('div'));
			this._axisY.setAttribute('class','axisY');
		}
		if(('title' in v) || ('unit' in v)){
			var title=v.title||'';
			if(v.unit && v.unit[0]!==':')title=title+' ('+v.unit+')';
			if(title){
				if(!this._axisY._title){
					this._axisY._title=this._axisY.appendChild(document.createElement('div'));
					this._axisY._title.setAttribute('class','title');
				}
				this._axisY._title.innerHTML=title;
			}else if(this._axisY._title){
				this._axisY._title.remove();
			}
		}
		if('y' in v || 'v' in v || 'max' in v || 'min' in v || 'step' in v || 'rnd' in v || 'unit' in v || 'bb' in v)
			setTimeout(()=>this._drawAxisY(),5);
		this._moveTriggers.axisy=()=>{this._drawAxisY()};
	}
}
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// animation
gui.animationTargetDone=function(animation,curval){
	animation.ti++;											//next target value
	if(animation.ta &&
		(++animation.tai)===animation.ta.length)			//next target attraction force
			animation.tai=0;
	if(animation.ti===animation.to.length){
		if(animation.tu--){									//next repeat cycle
			animation.ti=0;
		}else{												//if this is last target, stop animation
			gui.animations.delete(animation);
			animation._item._allprop['+'+animation._propName]=
				animation._item._prop['+'+animation._propName]=null;
		}
	}
	if(animation.tu>-1){
		if(animation.te!==null && animation.te.constructor===Number){	//change to exit velocity as proportion of terminal velocity
			animation.vy*=animation.te;
		}else if(animation.te && animation.te.constructor===Array){		//change to next exit-velocity in "te" carousel
			animation.vy=animation.te[animation.tei];
			if((++animation.tei)===animation.te.length)		//next exit velocity
				animation.tei=0;
		}else{															//default behavior -- bounce off toward next goal
			if((animation.to[animation.ti]>curval && animation.vy<0) ||
				(animation.to[animation.ti]<curval && animation.vy>0))
					animation.vy*=-1;
		}
	}
}
gui.animate=function(timeStep,animation){
	if(document.body.contains(animation._item._element)){
		var goal=animation.to===null?null:animation.to[animation.ti];
		var curval=animation._item._allprop[animation._propName];
		//check target attraction
		if(goal!==null && animation.ta){
			var acceleration=animation.ta[animation.tai]*timeStep/1000;
			if(acceleration<0 &&
					((curval<goal&&animation.vy>0)||
					(curval>goal&&animation.vy<0))){
				if(curval<goal){
					animation.vy+=acceleration;
					if(animation.vy<=0){
						animation.vy=0;
						gui.animationTargetDone(animation,curval);
					}
				}else if(curval>goal){
					animation.vy-=acceleration;
					if(animation.vy>=0){
						animation.vy=0;
						gui.animationTargetDone(animation,curval);
					}
				}
			}else{
				if(curval<goal)animation.vy+=acceleration;
				else if(curval>goal)animation.vy-=acceleration;
			}
		}
		//increment property value according to its velocity
		if(animation.vy){
			var newval=curval+animation.vy*timeStep/1000;
			if(goal!==null && (curval<goal&&newval>=goal)||(curval>goal&&newval<=goal)){ //if target value was reached, animate to next target or stop
				newval=goal;
				gui.animationTargetDone(animation,newval);
			}
			//refresh animated property on display
			animation._item._allprop[animation._propName]=animation._item._prop[animation._propName]=newval;
			animation._item[animation._propName](newval);
		}
	}else{
		gui.animations.delete(animation);
	}
}
gui.startAnimation=function(animation,item,propName){
	//add references to this animation object
	animation._item=item;
	animation._propName=propName;
	//defaults
	if(!animation.vy)animation.vy=0;
	if(!animation.ti)animation.ti=0;
	if(!animation.tu)animation.tu=0;
	if(!animation.tai)animation.tai=0;
	if(!animation.tei)animation.tei=0;
	if(animation.te===undefined)animation.te=null;
	//turn "to" into array or null
	if(animation.to===undefined)animation.to=null;
	else if(animation.to!==null&&animation.to.constructor!==Array)animation.to=[animation.to];
	//turn "ta" into array or null
	if(animation.ta===undefined)animation.ta=null;
	else if(animation.ta!==null&&animation.ta.constructor!==Array)animation.ta=[animation.ta];
	//start animation
	gui.animations.add(animation);
}
gui.Num.prototype['+v']=function(v){gui.startAnimation(this._allprop['+v'],this,'v')}
gui.Item.prototype['+x']=function(v){
	if(this._allprop.x===undefined || this._allprop.x===null){
		this._allprop.x=this._prop.x=0;
		this.x(0);
	}
	this._setAttr('x','');
	gui.startAnimation(this._allprop['+x'],this,'x');
}
gui.Item.prototype['+y']=function(v){
	if(this._allprop.y===undefined || this._allprop.y===null){
		this._allprop.y=this._prop.y=0;
		this.y(0);
	}
	this._setAttr('y','');
	gui.startAnimation(this._allprop['+y'],this,'y');
}
gui.Item.prototype['+w']=function(v){
	if(this._allprop.w===undefined || this._allprop.w===null){
		this._allprop.w=this._prop.w=0;
		this.w(0);
		this._setAttr('w','');
	}
	gui.startAnimation(this._allprop['+w'],this,'w');
}
gui.Item.prototype['+h']=function(v){
	if(this._allprop.h===undefined || this._allprop.h===null){
		this._allprop.h=this._prop.h=0;
		this.h(0);
		this._setAttr('h','');
	}
	gui.startAnimation(this._allprop['+h'],this,'h');
}
//////////////////////////////////////////////////////////////////////////////
