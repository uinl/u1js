/*u1js -- in-browser interpreter for UINL v1.1

	What is UINL?
		UINL is a toolkit-independent language for describing UI updates and interactions.
		It is meant to provide the same access and experience for both human and simulated users.
		http://uinl.github.io/


	Are all optional UI component types and properties from the UINL spec implemented in u1js?
		Not yet.
			UINL does not require for all features to be implemented in UI software.
			Any features that are required by app-side software (i.e., declared via the "require" command)
				that are not implemented will raise an error (i.e. will send {!:Error...} message).
			See const IMPLEMENTED below for list of implemented UINL features.
*/


"use strict";


const USERAGENT='u1js (v1.1.20230309)';

// IMPLEMENTED describes all UINL properties/commands that are implemented here
const IMPLEMENTED={
	// core UINL options (U, Q, S, require, v, id) are all implemented
	U:[], Q: [], S:[], require:[], v:[], id:[],
	// additionally, the following option-values are available (i.e., requirable by app software)
	//   ( [] means any potential values for a given option can be handled )
	// error
	'!':[],
	// open link
	open:[],
	// save file
	save:[],
	// load stylesheet
	style:[],
	// templates
	tl:[],
	// search commands
	'U*':[],
	'U**':[],
	// request info command
	R:[],
	// scheduling commands
	T:[],Tr:[],
	Td:[],Ti:[],
	Tn:[],Tc:[],
	// common options
	c:[
		'txt', 'doc',						// text types (string values)
		'num', 'dt', 'time',				// numeric types (number values)
		'btn', 'hold', 'opt',		 		// toggle types (boolean values)
		'bin', 'grid', 'one', 'win' 		// container types (array values)
	],
	cap:[],
	i:[],
	tag:[],
	ef:[],
	tip:[],
	sx:[], sy:[],
	// interactive options
	in:[],
	keys:[],
	fcs:[],
	cls:[],
	on:[						// events
		'v',					// value-change event
		'fcs',				    // focus gained/lost
		'fold' ,				// fold/unfold event
		'sx', 'sy',				// scroll events
		'xy', 'wh', 'whc',		// resize/reflow events
		'o',					// overlap (i.e., collision)
		'k', 'ku',				// keyboard key-down, key-up events
		'pd', 'pu',				// pointer-device down/up events (e.g. mouse-button-down, mouse-button-up or touch-start, touch-end)
		'pc', 'pcc',			// pointer-device click/tap and double-click/double-tap events
		'p',					// pointer-device move and move-end events
		'po',					// pointer over/out events
		'md', 'mu', 'sw', 'swh' // secondary mouse buttons and mouse scrollwheel events
	],
	// numeric options
	max:[], min:[], step:[],
	unit:[],
	// radio button grouping option
	grp:[],
	// container options
	df:[],
	fold:[],
	// file type option
	fmt:['html','mkdn'],
	// win modal option
	mod:[]
}


//////////////////////////////////////////////////////////////////////////////
// Helper functions
location.params={};location.search.substring(1).split("&").forEach(function(a){var b=a.split("=");location.params[b[0]]=b[1]});
const MIMETYPES={
	txt:'text/plain',
	csv:'text/csv',
	js:'text/js',
	css:'text/css',
	ics:'text/calendar',
	html:'text/html',
	xml:'text/xml',
	json:'application/json',
};
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
	if(url && (url.endsWith(".js")||filetype==='js')){	   //if filename is a external JavaScript file
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
function localTimestamp(){
	var now = new Date(),
	offset = now.getTimezoneOffset() * 60;
	return (+now /1000) - offset;
}
function dateISO(){
	var d=new Date(localTimestamp()*1000),
		tzo=d.getTimezoneOffset(),
		tzoSign=(tzo<=0?'+':'-');
	tzo=Math.abs(tzo);
	return d.toJSON().substring(0,23)+tzoSign+Math.floor(tzo/60).toString().padStart(2,'0')+(tzo%60).toString().padStart(2,'0');
}
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
function hiddenProp(obj,key,val){
	Object.defineProperty(obj, key, {
		enumerable: false,
		writable: true,
		value: val
	});
}
//////////////////////////////////////////////////////////////////////////////



//////////////////////////////////////////////////////////////////////////////
// Logging
//	call logToConsole() to log all uinl messages to console
//	call stopLog() to discontinue logging
const pass=function(){};
var logline=pass;
function json(data){return (typeof(data)==='string')?data:JSON.stringify(data);}
function stopLog(){logline=pass;}
function logToConsole(){
	logline=function(data){console.log(json(data));};
}
function toggleLogging(){
	if(logline===pass)logToConsole();
	else stopLog();
}
//add logging hotkey (bound to CTRL-SHFT-\)
window.addEventListener('keydown',e=>{
	if(e.ctrlKey&&e.key==='|')toggleLogging();
});
//////////////////////////////////////////////////////////////////////////////




//////////////////////////////////////////////////////////////////////////////
// gui object definitions
function gui(data){
	if(data.constructor===Object){
		data=gui.shortProp(data);
		gui.rootContainer._update(data);
	}
}
gui.appEvent=function(msg){
	logline(msg);
	gui(msg);
}
gui.appEventJSON=function(msg){
	gui.appEvent(JSON.parse(msg));
}


gui.REQUIRED={
	Mkdn:[
		"https://cdn.jsdelivr.net/npm/marked/marked.min.js",
		"gui.markdown=marked;"
	]
};
gui.LONGFORM={'state': 'S', 'queue': 'Q', 'update': 'U', 'add': 'A', 'class': 'c', 'value': 'v', 'error': '!', 'time': 'T', 'trigger': 'Tr', 'timeDelay': 'Td', 'timeInterval': 'Ti', 'timingName': 'Tn', 'timingCancel': 'Tc', 'request': 'R', 'updateChildren': 'U*', 'updateDeep': 'U**', 'move': 'M', 'addTags': 'Atag', 'async': '@', 'templates': 'tl', 'caption': 'cap', 'contextMenu': 'ctx', 'scrollX': 'sx', 'scrollY': 'sy', 'index': 'i', 'effect': 'ef', 'affect': 'af', 'reference': 'ref', 'input': 'in', 'onEvent': 'on', 'throttle': 'throt', 'focus': 'fcs', 'keyShortcuts': 'keys', 'movable': 'mv', 'movableDeep': 'mv*', 'deletable': 'del', 'closeable': 'cls', 'reorderable': 'ro', 'goButton': 'go', 'encrypt': 'enc', 'markText': 'mark', 'foldable': 'fold', 'size': 'wh', 'defaults': 'df', 'logScale': 'log', 'length': 'len', 'optionGroup': 'grp', 'holdGroup': 'hgrp', 'modal': 'mod', 'location': 'xy', 'columns': 'cols', 'headerRow': 'head', 'hexGrid': 'hex', 'format': 'fmt', 'plotType': 'plt', 'errorBar': 'err', 'errorBarBottom': 'err2', 'width': 'w', 'height': 'h', 'rotation': 'rot', 'shape': 'shp', 'opaque': 'opq', 'scaleX': 'x^', 'scaleY': 'y^', 'direction': 'dir', 'depth': 'd', 'rotationX': 'rx', 'rotationY': 'ry', 'scaleZ': 'z^', 'overlap': 'ovr', 'frameset': 'fs', 'frame': 'f', '+frame': '+f', '+value': '+v', '+scrollX': '+sx', '+scrollY': '+sy', '+width': '+w', '+height': '+h', '+rotation': '+rot', '+scaleX': '+x^', '+scaleY': '+y^', '+frameOptions': '+f|', '+valueOptions': '+v|', '+scrollXOptions': '+sx|', '+scrollYOptions': '+sy|', '+xOptions': '+x|', '+yOptions': '+y|', '+widthOptions': '+w|', '+heightOptions': '+h|', '+rotationOptions': '+rot|', '+scaleXOptions': '+x^|', '+scaleYOptions': '+y^|', '+depth': '+d', '+rotationX': '+rx', '+rotationY': '+ry', '+scaleZ': '+z^', '+depthOptions': '+d|', '+zOptions': '+z|', '+rotationXOptions': '+rx|', '+rotationYOptions': '+ry|', '+scaleZOptions': '+z^|'};
gui.TYPES={};
gui.NO_ATTR=new Set(['!','style','require','open','A','Atag','Q','R','S','T','Td','U','U*','U**','+v','+x','+y','+w','+h','df','on','throt']);

gui.resetDisplay=function(){
	document.body.innerHTML='';
	gui.cancelScheduledEvents({});
	gui.rootContainer=new gui.Root({},document.body);
	document.body._item=gui.rootContainer;
	window._item=gui.rootContainer;
}
// gui.ums=function(){return Date.now()-gui.startTime;};
gui.ums=0;
gui.sendUserEvent=async function(msg){
	msg.t=gui.ums||1; //set msg time (never set to zero, so there's only 1 handshake message)
	if(gui.session)msg.s=gui.session;
	logline(msg);
	gui.checkMessageTriggers(msg);
	gui.userEvent(msg);
};
gui.vType=function(v){return {undefined:gui.Bin,object:gui.Bin,string:gui.Txt,number:gui.Num,boolean:gui.Btn}[typeof(v)]};
gui.getType=function(prop){if(prop.c && (prop.c in gui.TYPES))return gui.TYPES[prop.c]};
gui.shortProp=function(propVal){
	if(propVal && propVal.constructor===Object){
		var propShort={};
		for(let prop of Object.entries(propVal)){
			propShort[gui.LONGFORM[prop[0]]||prop[0]]=gui.shortProp(prop[1]);
		}
		return propShort;
	}else if(propVal && propVal.constructor===Array){
		var propShort=[];
		for(let prop of propVal){
			propShort.push(gui.shortProp(prop));
		}
		return propShort;
	}else{
		return propVal;
	}
}
gui.prop=x=>(x.constructor===Object)?x:{v:x};
gui.getColor=v=>getComputedStyle(document.body).getPropertyValue('--color'+v);
gui.color=v=>gui.getColor(v)?`var(--color${v})`:v;
gui.ids={};
gui.uniqueId=function(id){
	var items=gui.ids[id];
	if(items.length==1)return true;
	for(var i=items.length;i--;){
		if(!items[i]._exists())
			items.splice(i,1);
	}
	if(items.length==1)return true;
}
gui.scheduledUpdates={};
gui.cancelScheduledEvents=function(tc){
	//clear and remove prior instances of Tc id in scheduled updates
	if(tc.constructor===Object){		// Tc:{} (wildcard) -- stop/remove all prior scheduled updates
		//TODO: this will not remove unnamed scheduled updates, but should
		for(let tc in gui.scheduledUpdates){
			if(gui.scheduledUpdates[tc].constructor===Array){
				gui.msgTriggers.delete(gui.scheduledUpdates[tc]);
			}else if(gui.scheduledUpdates[tc].constructor===Number){
				clearTimeout(gui.scheduledUpdates[tc]);
				clearInterval(gui.scheduledUpdates[tc]);
			}
			delete gui.scheduledUpdates[tc];
		}
	}else{								// Tc:<<tcId>> -- stop/remove timeouts for specific <<tcId>>
		if(gui.scheduledUpdates[tc]){
			if(gui.scheduledUpdates[tc].constructor===Array){
				gui.msgTriggers.delete(gui.scheduledUpdates[tc]);
			}else if(gui.scheduledUpdates[tc].constructor===Number){
				clearTimeout(gui.scheduledUpdates[tc]);
				clearInterval(gui.scheduledUpdates[tc]);
			}
			delete gui.scheduledUpdates[tc];
		}
	}
}
gui.msgTriggers=new Set();
gui.triggerMatch=function(trigger,msg){
	if(Object.keys(trigger).length===0)return true;	//wildcard trigger
	var val;
	for(var key in trigger){
		val=trigger[key];
		if(val && val.constructor===Object){		//value wildcard
			if(!(key in msg))return false;
		}else{										//exact match
			if(msg[key]!==val)return false;
		}
	}
	return true;
}
gui.checkMessageTriggers=function(msg){
	for(var [trigger,f] of gui.msgTriggers){
		if(gui.triggerMatch(trigger,msg)){
			f(msg);
		}
	}
}
gui.animations=new Set();
gui.propWatch=new Set();
gui.loop=function(now){
	//progress animations
	if(gui.animations.size){
		const deltaTime=(now-gui.ums)/1000;
		for(let ani of gui.animations){
			gui.animate(deltaTime,ani);
		}
	}
	//go through properties added to watch-list via event-capture option "on"
	if(gui.propWatch.size){
		let propName;
		for(let item of gui.propWatch){
			if(item._propWatch.size&&item._exists()){
				for(propName of item._propWatch)
					item._checkProp(propName);
			}else{
				gui.propWatch.delete(item);
			}
		}
	}
	gui.ums=Math.round(now);
	requestAnimationFrame(gui.loop);
}
requestAnimationFrame(gui.loop);
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// require/load ui features
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
	//check that all requested options are implemented
	var errorScreen=[];
	for(var propName in require){
		if(!(propName in IMPLEMENTED)){
			gui.sendUserEvent({'!':'Sorry, I cannot handle required option: '+propName});
			errorScreen.push({id:'Cannot handle required property option(s)',v:[propName]});
		}else{
			if(IMPLEMENTED[propName].length){
				if(require[propName].constructor!==Array)require[propName]=[require[propName]];
				if(require[propName].length===0){
					gui.sendUserEvent({'!':'Sorry, I cannot handle required all possible values for {'+propName+'}'});
					errorScreen.push({id:'Cannot handle all values for required property',v:[propName]});
				}else{
					for(var v of require[propName]){
						if(!IMPLEMENTED[propName].includes(v)){
							gui.sendUserEvent({'!':'Sorry, I cannot handle required option-value: {'+propName+':'+JSON.stringify(v)+'}'});
							errorScreen.push({id:'Cannot handle required property option(s)',v:['{'+propName+':'+JSON.stringify(v)+'}']});
						}
					}
				}
			}
		}
	}
	if(errorScreen.length){
		gui({v:[null,{id:'Error',v:errorScreen}]});
		if(gui.ws)gui.ws.close();
	}
};
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
--colorFalseHover: #f0f0f0;
--colorTrue: lightblue;
--colorLink: #0066ff;
}
* {scrollbar-width:thin;box-sizing:border-box}
scrollbar {width:5px;height:5px;}
a {color:var(--colorLink);cursor:pointer;text-decoration:underline}
::-webkit-scrollbar {width:5px;height:5px;}
::-webkit-scrollbar-thumb {background: rgba(90,90,90,0.3);}
::-webkit-scrollbar-track {background: rgba(0,0,0,0.1);}
body {background-color:var(--color0);color:var(--color1);font-size:18pt;overflow:overlay} 
[level="0"] , [level="0"]>* {margin:0px !important;padding:0px !important;width:100% !important;height:100% !important}
div {position:relative}
[c] {border-width:0px;border-style:solid;border-color:#444;stroke:var(--color1);fill:none;overflow:visible;z-index:1;margin:3px;margin-left:6px; margin-top:0.5em; min-width:1em;min-height:1em;}
[c][level="1"] {margin-left:1px}
.title:not(:empty):not(td) {white-space:nowrap;overflow:visible;user-select:none}
.title:empty {margin:0px}
.subcaption {font-size:70%;font-weight:500;text-decoration:underline}
.content {overflow:hidden;border:none;left:0px;right:0px;font-size:90%}
.frame {overflow:auto;max-width:100%;max-height:100%;}
input , textarea {font-family:consolas, monospace;color:var(--color1)}
[c] {overflow:visible}
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
		this._content._item=this._title._item=this._frame._item=this._element._item=this._outerElement._item=this;
		this._level=parent._level+1;
		this._setAttr('level',this._level);
		this._prop={c:this._classDefaults.c};
		this._setAttr('c',this._classDefaults.c)
		// this._id(prop.id);
		this._initDefaults(prop);
		this._update(prop);							//refresh attributes based on own properties and class defaults
	}
	_initContent(){
		this._element=document.createElement('div');									//element container (overflow:visible so that shapes/axes can show)
		this._title=this._element.appendChild(document.createElement('div'));			//title (this is where id/title goes)
		this._content=this._element.appendChild(document.createElement('div'));			//content (includes value)
		this._frame=this._content;
		this._parent._placeChildElement(this);
	}
	_initDefaults(prop){
		var df=this._parent._prop.df;
		for(var p in df){
			if(df[p] && df[p].constructor===Object){
				if(!(p in prop))prop[p]={}; //TODO: since this only happens on creation, this if statement is unnecessary
				for(var subprop in df[p]){
					if(!(subprop in prop[p])) //TODO: since this only happens on creation, this if statement is unnecessary
						prop[p][subprop]=df[p][subprop];
				}
			}else if(!(p in prop)){
				prop[p]=(df[p] && df[p].constructor===Array)?
					[...df[p]]:df[p];
			}
		}
		if(!('v' in prop))prop.v=this._classDefaults.v;
		delete prop.c;
	}
	_beforeRemove(){}
	_attr(attr){return this._element.getAttribute(attr);}
	_setAttr(attr,val){
		if(val===null)this._element.removeAttribute(attr);
		else this._element.setAttribute(attr,val);
	}
	_delay(prop,delay){
		if(!('Tn' in prop))prop.Tn=Math.random();
		var timeoutId=setTimeout(()=>{
				delete gui.scheduledUpdates[prop.Tn];
				this._update(prop);
			},delay);
		gui.scheduledUpdates[prop.Tn]=timeoutId;
	}
	_interval(prop){
		var ti=prop.Ti*1000,propJson;
		delete prop.Ti;
		if(!('Tn' in prop))prop.Tn=Math.random();
		propJson=JSON.stringify(prop);
		this._update(JSON.parse(propJson));
		var intervalId=setInterval(()=>{
				this._update(JSON.parse(propJson));
			},ti);
		gui.scheduledUpdates[prop.Tn]=intervalId;
	}
	_update(prop){
		if(prop.Td){								//delay current update for a specified number of seconds
			let delay=prop.Td*1000;
			delete prop.Td;
			this._delay(prop,delay);
		}else if(prop.Ti){
			this._interval(prop);					//current update will execute on a specified interval
		}else if(prop.v===null){	 				//if v==null, delete this item
			this._prop.v=null;
			if(this._parent){
				this._parent._removeChild(this);
				if(prop.R)this.R(prop.R);
			}else{
				gui.resetDisplay();
				if(prop.R)gui.rootContainer.R(prop.R);
			}
		}else{
			if(prop.c!==undefined){
				if(prop.c!==this._classDefaults.c){
					this.c(prop.c,prop);
					return;
				}
			}else if(prop.v!==undefined && prop.v.constructor!==this._classDefaults.v.constructor){
				// console.log(prop,prop.v.constructor,{Array:'bin',Boolean:'btn',String:'txt',Number:'num'}[prop.v.constructor]);
				// prop.c={Array:'bin',Boolean:'btn',String:'txt',Number:'num'}[prop.v.constructor];
				prop.c=gui.vType(prop.v).prototype._classDefaults.c;
				this.c(prop.c,prop);
				return;
			}
			let r=prop.R;											//if there is an R command, save it for later
			if(r)delete prop.R;
			let q=prop.Q;											//if there is an Q command, save it for later
			if(q)delete prop.Q;
			if(prop.df!==undefined){
				this._updateProp('df',prop.df);
				delete prop.df;
			}
			if(prop.v!==undefined){
				this._updateProp('v',prop.v);
				delete prop.v;
			}
			for(var propName in prop){
				if(!propName.startsWith('+'))
					this._updateProp(propName,prop[propName]);
			}
			for(var propName in prop){
				if(propName.startsWith('+'))
					this._updateProp(propName,prop[propName]);
			}
			if(r)this.R(r);
			if(q && q.constructor===Array){
				for(let prop of q)
					this._update(prop);
			}
		}
	}
	_updateProp(propName,propVal){
		if(propVal===null){
			if(propName in this._prop){
				if(this._prop[propName] && this._prop[propName].constructor===Object){
					propVal={};
					for(var subprop in this._prop[propName]){
						propVal[subprop]=null;
					}
				}
				delete this._prop[propName];
			}
		}else if(this._prop[propName] && this._prop[propName].constructor===Object && propVal.constructor===Object){
			for(var key in propVal){
				if(propVal[key]===null){
					delete this._prop[propName][key];
				}else{
					this._prop[propName][key]=propVal[key];
				}
			}
		}else{
			this._prop[propName]=propVal;
		}
		this._refreshProp(propName,propVal);
	}
	_refreshProp(propName,propVal){
		try{
			if(this[propName]){
				//run the class-specific property function
				this[propName](propVal);
				//set DOM attribute
				if(propName==='v'){
					if(propVal.constructor===Boolean)this._setAttr('v',propVal);
					else this._moveHook();
				}else if(!gui.NO_ATTR.has(propName)){
					try{
						this._setAttr(propName,propVal);
					}catch(e){}
				}
			}
		}catch(e){
			console.error(e.stack);
			this._sendMsg({'!':`Problem setting ${propName} to ${propVal} :: [[${e.stack}]]`});
		}
	}
	_getIndex(){return this._parent._children.indexOf(this);}
	_match(query){
		if(query.constructor===Object){
			for(var q in query){
				if(this._prop[q]&&query[q].constructor===Array){
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
	_uniqueId(){return this._prop.id && gui.uniqueId(this._prop.id);}
	_getId(){
		if(this._uniqueId()){
			return this._prop.id;
		}else if(this._parent===gui.rootContainer){
			return this._getIndex();
		}else{
			//Warning: This will give non-unique in-container id (tho that's consistent with UINL1.1 spec)
			var parent=this._parent,
				fullname=[this._prop.id||this._getIndex(),parent._prop.id||parent._getIndex()];
			while(parent._parent!==gui.rootContainer && !parent._uniqueId()){
				parent=parent._parent;
				fullname.push(parent._prop.id||parent._getIndex());
			}
			return fullname.reverse();
		}
	}
	_sendMsg(msg){
		msg.u=this._getId();
		gui.sendUserEvent(msg);
	}
	_moveHook(){
		for(var f in this._moveTriggers){
			this._moveTriggers[f]();
		}
	}
	_exists(){return document.body.contains(this._element);}
	c(v,props={}){
		if(v!==this._classDefaults.c){
			if(!('i' in props))props.i=this._getIndex();
			if(this._prop.v!==undefined && this._prop.v.constructor!==gui.TYPES[v].prototype._classDefaults.v.constructor)
				delete this._prop.v;
			props=Object.assign({},this._prop,props);
			this._parent._removeChild(this);
			this._parent._newChild(props);
		}
	}
	v(v){this._content.innerText=v;}
	id(v){
		if(typeof(v)==='string'){
			// this._setAttr('id',v);
			// this._prop.id=v;
			this._parent._childmap[v]=this;
			this.cap();
			var iditems=gui.ids[v];
			if(iditems)iditems.push(this);
			else gui.ids[v]=[this];
		}
	}
	cap(v){
		var title=(v===null||v===undefined)?this._prop.id:v;
		if(title){
			if(!this._titleText){
				this._titleText=this._title.appendChild(document.createElement('span'));
				this._titleText._item=this;
			}
			this._titleText.innerText=title;
		}else if(this._titleText){
			this._titleText.remove();
		}
	}
}
gui.Item.prototype['!']=function(v){console.error(this._prop,v);};
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// prototypical gui container
gui._Container=class extends gui.Item{
	_initContent(){
		this._element=document.createElement('div');									//element container (overflow:visible so that shapes/axes can show)
		this._title=this._element.appendChild(document.createElement('div'));			//title (this is where id/title goes)
		this._frame=this._element.appendChild(document.createElement('div'));			//content frame (overflow:auto so that content can be scrolled)
		this._content=this._frame.appendChild(document.createElement('div'));			//content
		this._parent._placeChildElement(this);
	}
	_initDefaults(prop){
		this._prop.df=Object.create(this._parent._prop.df);
		this._children=[];
		this._childmap={};
		super._initDefaults(prop);
	}
	_update(prop){
		if(prop.Td){							//delay current update for a specified number of seconds
			let delay=prop.Td*1000;
			delete prop.Td;
			this._delay(prop,delay);
		}else if(prop.Ti){
			this._interval(prop);				//current update will execute on a specified interval
		}else if('U' in prop){					//if there is a U command, find child item and update
			let searchId=prop.U;
			delete prop.U;
			this._searchId(searchId,prop);
		}else if('U**' in prop){				//if there is a U** command, search and update matching descendant items
			let searchTerms=prop['U**'];
			delete prop['U**'];
			this._searchRecur(searchTerms,prop);
		}else if('U*' in prop){					//if there is a U* command, search and update matching child items
			let searchTerms=prop['U*'];
			delete prop['U*'];
			this._searchStar(searchTerms,prop);
		}else{
			super._update(prop);
		}
	}
	_placeChildElement(child){
		this._content.appendChild(child._element);
		child._outerElement=child._element;
	}
	_checkContainerBool(){
		var boolItem;
		for(var child of this._children){
			if(child instanceof gui.Btn)
				if(boolItem)return null;
			else
				boolItem=child;
		}
		if(boolItem && boolItem._prop.in!==0 && boolItem._prop.in!==-1 &&
			(boolItem._prop.cap=='' || (!boolItem._prop.cap && !boolItem._prop.id)))
			return boolItem;
	}
	_containerBool(){
		var cbool=this._checkContainerBool();
		if(this._containerBoolean && cbool!=this._containerBoolean && this._containerBoolean._unbind)
			this._containerBoolean._unbind();
		this._containerBoolean=cbool;
		if(cbool){
			this._containerBoolean._bind(this);
			this._setAttr('btnContainer',1);
			this._setAttr('v',Boolean(this._containerBoolean._prop.v));
		}else{
			this._setAttr('btnContainer',null);
		}
	}
	_newChild(prop){
		var type=gui.getType(prop);
		if(type===gui.Win && this!==gui.rootContainer)type=gui.Bin;
		if(!type){
			var defaultType=gui.getType(this._prop.df);
			if('v' in prop){
				type=gui.vType(prop.v);
				if(defaultType&&(defaultType.prototype instanceof type))
					type=defaultType;
			}else if(defaultType){
				type=defaultType;
			}else if('v' in this._prop.df){
				type=gui.vType(this._prop.df.v);
			}else{
				type=gui.Bin;
				prop.v=[];
			}
		}
		var child=new type(prop,this);
		if(!this._children.includes(child))	//this check is in case "i" was used to push into _children
			this._children.push(child);
		return child;
	}
	_removeChild(child){
		child._beforeRemove();										//cleanup
		if(child._prop.id)delete this._childmap[child._prop.id];	//remove from _childmap
		this._children.splice(this._children.indexOf(child),1);		//remove from _children
		child._outerElement.remove();			   					//remove DOM element
	}
	_searchStar(searchTerms,prop){
		for(var child of this._children){
			if(child._match(searchTerms))
				child._update(prop);
		}
	}
	_searchRecur(searchTerms,prop){
		for(var child of this._children){
			if(child._match(searchTerms))
				child._update(prop);
			if(child instanceof gui.Bin)
				child._searchRecur(searchTerms,prop);
		}
	}
	_searchId(id,prop){
		return this._searchIdArray(id.constructor===Array?id:[id],prop);
	}
	_searchIdArray(id,prop){
		var child=typeof(id[0])==='number'?this._children[id[0]]:this._childmap[id[0]];
		if(child){
			if(id.length>1){
				return child._searchIdArray(id.slice(1),prop);
			}else{
				if(prop)child._update(prop);
				return child;
			}
		}else{
			for(var child of this._children){
				if(child instanceof gui.Bin){
					var c=child._searchIdArray(id,prop);
					if(c)return c;
				}
			}
		}
	}
	A(updates){
		//cycle through all updates for this container
		for(var prop of updates){
			if(prop!==null){
				this._newChild(gui.prop(prop));
			}
		}
	}
	v(updates){
		//clear bin
		for(var i=this._children.length;i--;){
			this._children[i]._beforeRemove();
			this._children[i]._outerElement.remove();
		}
		this._childmap={};
		this._children=[];
		//add updates
		this.A(updates);
	}
	df(){}
}
//////////////////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////////////////////////
// Bin
addCSS(`
[c='bin']:not(tr):not([tag]):not([shp]):not([h]):not([level='0']) {border-left: solid 0.2px #ccc}
[c='bin']:not(tr)[id]:not([cap='']):not([y]) , [c='bin']:not(tr)[cap]:not([cap='']):not([y]) {margin-top:1.5em}
[c='bin']:not(tr) > .title:empty {display:none}
[c='bin']:not(tr) > .title:not(empty) {position:absolute;bottom:100%;border-bottom:solid 1px var(--colorBorder);}
[c='bin']:not(tr) > .content {display:block}
`);
gui.Bin=class extends gui._Container{};
gui.Bin.prototype._classDefaults={c:'bin',v:[]};
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// root
gui.Root=class extends gui._Container{
	_sendMsg(msg){gui.sendUserEvent(msg)}
	_initDefaults(prop){
		this._prop.df={};
		this._children=[];
		this._childmap={};
		this._parent=null;
		this._prop.id=null;
		this._pw=1;
		this._ph=1;
	}
	_update(prop){
		if('Tc' in prop){gui.cancelScheduledEvents(prop.Tc)};
		if(prop.T){				//delay current update until a specific time
			let delay=prop.T-gui.ums;
			delete prop.T;
			this._delay(prop,delay);
		}else if(prop.Tr){		//current update will execute only on specific trigger
			if(!('Tn' in prop))prop.Tn=Math.random();
			var item=this,trigger=[prop.Tr],propJson;
			delete prop.Tr;
			propJson=JSON.stringify(prop);
			trigger.push(()=>item._update(JSON.parse(propJson)));
			gui.msgTriggers.add(trigger);
			gui.scheduledUpdates[prop.Tn]=trigger;
		}else{
			gui.btnBinsChanged=new Set(); //this is only for btn-containers
			super._update(prop);
			for(var bin of gui.btnBinsChanged)bin._containerBool(); //this is only for btn-containers
		}
	}
	S(v){gui.session=v;}
	require(v){
		if(Object.keys(v).length)
			gui.require(v);
		else
			this._sendMsg({requirable:IMPLEMENTED});
	}
	style(v){load(v);}
	open(v){window.open(v);}
	save(v){
		if(v.constructor===Array && v.length===2){
			var file = new Blob([v[1]], {type: 'text/plain'});
			var a = document.createElement("a"),
					url = URL.createObjectURL(file);
			a.href = url;
			a.download = v[0];
			document.body.appendChild(a);
			a.click();
			setTimeout(function() {
				document.body.removeChild(a);
				window.URL.revokeObjectURL(url);  
			}, 0); 
		}
	}
	cap(v){document.title=(v===null||v===undefined)?'':v;}
};
gui.Root.prototype._classDefaults={c:'bin',v:[]};
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// text items
addCSS(`
[c='txt'] > .title:empty {width:0px;height:0px;overflow:hidden}
[c='txt'] > .content {white-space:pre-wrap}
[c='txt'][id] > .content {margin-left:.5em}
[c='txt'][cap]:not([cap='']) > .content {margin-left:.5em}
textarea {white-space:pre;min-height:8ex;max-height:28ex;width:calc(100% - 0.5em);font-size:11pt;border:solid 1px lightgray !important}
`);
function autoHeight(element){
	if(element.constructor===HTMLTextAreaElement){
		element.style.height='0px';
		element.style.height=(5+element.scrollHeight)+'px';
		let p=element._item._parent, c=p._content;
		if(!('ch' in p._prop) && c.scrollHeight>getComputedStyle(c).height){
			p._content.style.height=p._content.scrollHeight;
		}
	}
}
gui.Txt=class extends gui.Item{
	v(v){
		if(this._prop.in && this._prop.in>0){
			if(v==='\n')v='';
			this._content.value=v;
			autoHeight(this._content);
		}else{
			this._content.innerText=v;
		}
	}
	A(v){this.v(this._prop.v+v);}
	in(v){
		this._content._removeListeners();
		if(v && v>0){
			var item=this,
				oneline=!this._prop.v.includes('\n');
			this._content.remove();
			this._frame=this._content=this._element.appendChild(document.createElement(
				oneline?'input':'textarea'
			));
			this._frame._item=this;
			var lastVal=item._prop.v;
			function send(){
				if(lastVal!==item._prop.v){
					item._sendMsg({v:item._prop.v});
					lastVal=item._prop.v;
				}
			}
			this._content._listen('input',function(e){
				item._prop.v=(oneline||item._content.value.includes('\n'))?
					item._content.value:(item._content.value+'\n');
				autoHeight(item._content);
			});
			this._content.onblur=send;
			if(oneline)
				this._content._listen('keypress',(e)=>{
					if(e.key=='Enter'){
						e.preventDefault();
						send();
					}
				});
		}else{
			this._content.remove();
			this._frame=this._content=this._element.appendChild(document.createElement('div'));
		}
		this._frame.className='frame content';
		this.v(this._prop.v);
	}
}
gui.Txt.prototype._classDefaults={c:'txt',v:''};
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// number items
addCSS(`
[c='num'] > input {padding-right:0px; text-align:right}
[c='num'] * {display:inline-block;vertical-align:middle}
[c='num'] > .title:empty {width:0px;height:0px;overflow:hidden}
[c='num'] > .title:not(:empty) {border-bottom:solid 1px var(--colorBorder);vertical-align:bottom;margin-top:inherit;margin-right:.75em}
[c='num'] > .title:not(:empty):after {content:":"}
[c='num'] > .content {display:inline-block; }

input[disabled] {background-color:transparent}
input:not([disabled]) {border:solid 1px lightgray}

[c='num'][unit]:after {content: attr(unit);font-size:80%;padding-left:2px;vertical-align:text-bottom}
`);
gui.Num=class extends gui.Item{
	// _initContent(){
	// 	this._element=document.createElement('div');									//element container (overflow:visible so that shapes/axes can show)
	// 	this._frame=this._element;
	// 	this._title=this._frame.appendChild(document.createElement('div'));				//title (this is where id/title goes)
	// 	this._content=this._frame.appendChild(document.createElement('input'));			//content (includes value)
	// 	this._content.type='number';
	// 	this._content.disabled=true;
	// 	this._parent._placeChildElement(this);
	// }
	_display(v,step,offset=0){
		if(step<1)v=v.toFixed(step.toString().split('.')[1].length);
		return v;
	}
	in(v){
		if(v && v>0){
			var c;
			this._content.remove();
			c=this._content=this._element.appendChild(document.createElement('input'));
			c.type='number';
			c._item=this;
			this.v(this._prop.v||0);
			c.oninput=function(){
				c._item._adjustWidth(c.value.length);
			}
			c.onchange=function(){
				c._item._updateProp('v',c.value);
				c._item._sendMsg({v:c._item._prop.v});
			};
		}else{
			this._content.remove();
			this._content=this._element.appendChild(document.createElement('div'));
			this._content._item=this;
			this.v(this._prop.v||0);
		}
	}
	max(v){this.step();};
	min(v){this.step();};
	step(v){
		if(this._prop.step<0)this._prop.step*=-1;
		this._content.setAttribute('max',this._prop.max);
		this._content.setAttribute('min',this._prop.min);
		this._content.setAttribute('step',this._prop.step);
		this.v(this._prop.v);
	};
	unit(v){this.v(this._prop.v);};
	v(v){
		if(this._prop.min!==undefined)v=Math.max(v,this._prop.min);
		if(this._prop.max!==undefined){
			v=Math.min(v,this._prop.max);
			this._element.style.setProperty('--pp',`${(100*v/(this._prop.max-(this._prop.min||0)))}%`);
		}
		if(this._prop.step)v=(this._prop.min||0)+Math.round2(v-(this._prop.min||0),this._prop.step);
		this._prop.v=v;
		// this.in(this._prop.in);
		if(this._content.constructor===HTMLInputElement){
			this._content.value=this._display(v,this._prop.step,this._prop.min||0);
			if(this._lastLength!==this._content.value.length)
				this._adjustWidth(this._lastLength=this._content.value.length);
		}else{
			this._content.innerText=this._display(v,this._prop.step,this._prop.min||0);
		}
	}
	A(v){this.v(this._prop.v+v);}
	_adjustWidth(size){
		this._content.style.width=`calc(${size+1}ch + 2em)`;
	}
}
gui.Num.prototype._classDefaults={c:'num',v:0};
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// boolean items
addCSS(`
[c='btn']:active {background-color:var(--colorTrue) !important;}
[c='btn']:hover {background-color:var(--colorFalseHover) !important;}
[c='btn'] {text-align:center;display:inline-block;padding:.4em;background-color:var(--colorFalse);vertical-align:middle;}
[c='btn'] > * {display:inline-block}
[c='btn']:not([shp]) {box-shadow:0px 0px 3px 1px rgba(0, 0, 0, 0.3)}
[c='btn'][shp] {filter:drop-shadow(0px 0px 3px rgba(0, 0, 0, 0.7))}
[c='btn']:not(:empty),[select="0"]:not(:empty) {min-width:100px;border-radius:4px;}
[c='btn'][in]:empty {width:1em;height:1em;border-radius:2em;}
[btnContainer] [c='btn'] {display:none}
[btnContainer]:active {background-color:var(--colorTrue) !important;}
[btnContainer]:not(tr) {box-shadow:0px 0px 3px 1px rgba(0, 0, 0, 0.3);cursor:pointer;border-radius:4px;}
[v="true"]:not([c='txt']) {background-color:var(--colorTrue) !important;}
`);
gui.Btn=class extends gui.Item{
	_initContent(){
		this._element=document.createElement('div');			//make element inside parent
		this._setAttr('tabindex',0);
		this._element.onkeydown=function(e){if(!e.repeat&&(e.key=='Enter'||e.key===' ')){this._item._btnDown();e.preventDefault();e.stopPropagation()}};
		this._element.onkeyup=function(e){if(e.key=='Enter'||e.key===' '){this._item._btnUp();e.preventDefault();e.stopPropagation()}};
		this._frame=this._element;
		this._content=this._element;
		this._title=this._frame.appendChild(document.createElement('div'));				//title (this is where id/title goes)
		this._parent._placeChildElement(this);
		this._bind(this);
	}
	_refreshProp(propName,propVal){
		super._refreshProp(propName,propVal);
		gui.btnBinsChanged.add(this._parent);
	}
	_beforeRemove(){
		gui.btnBinsChanged.add(this._parent);
	}
	v(v){
		if(v){
			if(this._boundTo && this._boundTo!==this){
				this._boundTo._setAttr('v',v);
			}
			if(this._prop.in===1)
				setTimeout(()=>this._updateProp('v',false),200);
		}
	}
	A(v){this.v(!this._prop.v);}
	_btnDown(){this._setAttr('v',true);}
	_btnUp(){this._setAttr('v',false);this._boundTo._element.onclick();}
	_bind(item){
		var thisItem=this;
		this._boundTo=item;
		if(this._unbind)this._unbind();
		if(this._prop)
			item._setAttr('btnin',this._prop.in);
		item._element.onclick=function(e){							//click behavior
			thisItem._sendMsg({v:true});
		}
		this._unbind=function(){item._element.onclick=null;}
	}
}
gui.Btn.prototype._classDefaults={c:'btn',v:false};
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// initiate gui and connect to app
(function(){	//onload: initiate rootContainer and connect to app software
	//////////////////////////////////////////////////////////////////////////////
	// init window and connect to app
	function init(){
		//collect all types
		Object.values(gui).filter(v=>v.prototype&&v.prototype._classDefaults).forEach(c=>{if(!gui.TYPES[c.prototype._classDefaults.c])gui.TYPES[c.prototype._classDefaults.c]=c});
		//create foundational element
		document.body._level=-1;
		document.body._content=document.body;
		document.body._placeChildElement=function(child){
			this._content.appendChild(child._element);
			child._outerElement=child._element;
		}
		gui.resetDisplay();
		//connect to app
		if(!window.app)window.app={};
		if(window.userEvent || app.userEvent){
			//if app code is client-side script...
			connectToTaskScript();
		}else if(location.params.l || app.location){
			// load url if one is supplied...
			gui({v:['Loading...']});
			app.location=app.location || location.params.l;
			if(app.location.startsWith('ws://') || app.location.startsWith('wss://'))
				connectToTaskWS();
			else
				connectToTaskHTTP();
			//TODO: allow location of .js script
		}else{
			//TODO: change this to allow entering task location
			gui({v:['Hey there...',{id:'Intersted in the UINL?',v:"http://uinl.github.io/"}]});
		}
	}
	function onTaskConnect(){
		let msg={						// format handshake message
			userAgent: USERAGENT,
			wh: [gui.rootContainer._element.offsetWidth,gui.rootContainer._element.offsetHeight],
			platform: navigator.userAgent,
			time: dateISO(),
			url: location.href,
			screen:objectify(screen),
			t:0
		};
		logline(msg);
		// gui.startTime=Date.now()-1000;		// mark start-time
		gui.userEvent(msg);				// send handshake message to initiate app
	}
	function connectToTaskScript(){
		//	connect gui.userEvent to app.userAction
		gui.userEvent=app.userEvent || userEvent;
		//	connect app.display to gui.update;
		app.display=gui.display=gui.appEvent;
		//	start app
		onTaskConnect();
	}
	function connectToTaskHTTP(){
		if((location.params.method && location.params.method.toUpperCase()==='GET') || (app.method && app.method.toUpperCase()==='GET')){
			// parse app.location, add event= param to search string
			var [url,search]=app.location.split('?');
			if(search){
				if(search.endsWith('&'))url=app.location+'event=';
				else url=app.location+'&event=';
			}else{
				url+='?event='
			}
			// create gui.userEvent function to send event data via GET (in the search string under the event parameter)
			gui.userEvent=function(data){
				fetch(url+JSON.stringify(data))
				.then(r=>r.text())
				.then(gui.appEventJSON);
			};
		}else{
			// create gui.userEvent function to send event data via POST (as a JSON body)
			gui.userEvent=function(data){
				fetch(app.location,{
					method:'POST',
					headers:{'Content-Type': 'application/json'},
					body:JSON.stringify(data)
				})
				.then(r=>r.text())
				.then(gui.appEventJSON);
			};
		}
		onTaskConnect();
	}
	function connectToTaskWS(){
		if("WebSocket" in window){
			gui.userEvent = function(data){
				gui.ws.send(JSON.stringify(data));
			}
			gui.ws=new window.WebSocket(app.location);
			gui.ws.onerror=function(e){gui({v:null,'!':'Cannot establish connection to '+app.location});};
			gui.ws.onclose=function(event){
				console.log('Connection closed ('+event.code+').');
			};
			gui.ws.onopen=onTaskConnect;
			gui.ws.onmessage=gui.appEventJSON;
		}else{
			gui({v:[null,{id:'Error',v:'Your browser does not support websockets. Please use a modern browser to run this application.'}]});
		}
	}
	//////////////////////////////////////////////////////////////////////////////
	window.addEventListener("load",init);
})();
//////////////////////////////////////////////////////////////////////////////




//
// above this line are:
//   core UINL text&button features, caption, & delayed update commands
//////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////
// below this line are:
//   additional UI features (e.g. checkboxes, tables, text inputs, events, emphases)
//



// TODO: rectx recty should be returning position on page, not within viewport
//////////////////////////////////////////////////////////////////////////////
// R command (polling / property info request)
gui.Item.prototype._rectx=function(){return (this._element.getBoundingClientRect().x-this._parent._content.getBoundingClientRect().x)};
gui.Item.prototype._recty=function(){return (this._element.getBoundingClientRect().y-this._parent._content.getBoundingClientRect().y)};
gui.Item.prototype._rectw=function(){return this._element.offsetWidth};
gui.Item.prototype._recth=function(){return this._element.offsetHeight};
gui.Item.prototype._rectcw=function(){return this._content.getBoundingClientRect().width};
gui.Item.prototype._rectch=function(){return this._content.getBoundingClientRect().height};

gui.INFO={
	v(item){
		if(item instanceof gui.Bin){
			var childprop,v=[];
			for(var child of item._children){
				childprop={};
				for(var prop in child._prop){
					childprop[prop]=(prop in gui.INFO)?gui.INFO[prop](child):child._prop[prop];
				}
				v.push(childprop);
			}
			return v;
		}else{
			return item._prop.v;
		}
	},
	i(item){return item._getIndex()},
	fcs(item){return item._content===document.activeElement},
	sx(item){return item._frame.scrollLeft/item._rectcw()},
	sy(item){return item._frame.scrollTop/item._rectch()},
	xy(item){return [item._rectx(),item._recty()]},
	wh(item){return [item._rectw(),item._recth()]},
	whc(item){return [item._rectcw(),item._rectch()]}
}
gui.Item.prototype.R=async function(v){
	var r={};
	for(var info of v){
		if(info in gui.INFO)r[info]=await gui.INFO[info](this);
		else if(info.startsWith('+'))r[info]=this._prop[info];
		else r[info]=this._prop[info];
		if(r[info]===undefined)r[info]=null;
	}
	this._sendMsg({r:r});
}
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// additional item properties
addCSS(`
.tooltiptext {visibility:hidden;background-color:black;text-align:left;border-radius:0px;padding:5px;margin:0px;position:fixed;bottom:0px;left:0px;z-index:999;padding:5px;margin:0px;color:#ddd;font-size:9pt;font-family:Arial;text-shadow:none;white-space:pre-wrap}
.tooltiptext::first-line {font-weight:bold}
.contextMenu {display:none;position:fixed;z-index:10;padding:0.5em;background-color:var(--color0);border:solid 1px gray;box-shadow: rgba(149, 157, 165, 0.2) 0px 8px 24px;}
`);
gui.tooltipOn=function(e){
	if(!gui.tooltip){
		gui.tooltip=document.body.appendChild(document.createElement('span'));
		gui.tooltip.setAttribute('class','tooltiptext');
	}
	gui.tooltip.innerHTML=this._item._prop.tip;
	gui.tooltip.style.visibility='visible';
};
gui.tooltipOff=function(e){gui.tooltip.style.visibility='hidden';};
gui.Item.prototype.i=function(v){
	var parent=this._parent;
	if(parent && parent._children[v]!==this){
		var myindx=parent._children.indexOf(this);
		if(myindx>-1)
			parent._children.splice(myindx,1);	//remove from _children array
		if(v<parent._children.length){
			parent._content.insertBefore(this._outerElement,parent._children[v]._outerElement);
			parent._children.splice(v,0,this);
		}else{
			parent._content.appendChild(this._outerElement);
			parent._children.push(this);
		}
	}
};
gui.Item.prototype.tip=function(v){
	this._content.setAttribute('title',v);
	if(v){
		this._element.addEventListener('mouseenter',gui.tooltipOn);
		this._element.addEventListener('mouseleave',gui.tooltipOff);
	}else{
		this._element.removeEventListener(gui.tooltipOn);
		this._element.removeEventListener(gui.tooltipOff);
	}
}
gui.Item.prototype.ef=function(v){
	this.style.borderWidth=(1+v/2)+'px';
	this.style.strokeWidth=(1+v/2)+'px';
	this.style.fontWeight=(400+v*300);
}
// gui.Item.prototype.af=function(v){
// 	this.style.backgroundColor=; ? red v blue? thumb up/dn icons?
// }
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
gui.Item.prototype.sx=function(v){this._frame.scrollLeft=v+'%';}
gui.Item.prototype.sy=function(v){this._frame.scrollTop=v+'%';}
gui.Item.prototype.ctx=function(v){
	if(!gui._contextMenuDiv){
		gui._contextMenuDiv=document.body.appendChild(document.createElement('div'));
		gui._contextMenuDiv.className='contextMenu';
		gui._contextMenuDiv.setAttribute('tabindex', '0');
	}
	if(v){
		this._element.addEventListener('contextmenu',gui.contextMenu);
	}else{
		this._element.removeEventListener('contextmenu',gui.contextMenu);
	}
}
gui.contextMenu=function(e){
	e.preventDefault();
	gui._contextMenuDiv.style.display='block';
	gui._contextMenuDiv.style.left=e.clientX+1;
	gui._contextMenuDiv.style.top=e.clientY+1;
	gui._contextMenuDiv.innerHTML = 'hello<br><div><button>press me</button></div><button>press me</button>';
	gui._contextMenuDiv.focus();
	gui._contextMenuDiv.addEventListener('focusout',e=>{
		if(!gui._contextMenuDiv.contains(e.relatedTarget)){
			gui._contextMenuDiv.style.display='none';
			
		}
	});
	//TODO:
	//	add bin to this div based on definition in e.currentTarget._item._param.ctx
	//	hide context menu once anything else receives any event
}
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// interactive options
addCSS(`
[in="-1"] {pointer-events:none}
.controlWidth {z-index:10000;cursor:ew-resize;height:50%;width:0px;border-right:dotted 3px gray;position:absolute;right:-2.5px;top:25%}
.controlHeight {z-index:10000;cursor:ns-resize;width:50%;height:0px;border-bottom:dotted 3px gray;position:absolute;bottom:-2.5px;left:25%}
.controlMove {z-index:10000;cursor:move;width:50%;height:0px;border-top:solid 3px gray;position:absolute;top:-2.5px;left:25%}
[man*='x'],[man*='y'] {cursor:move}
`);
gui.Bin.prototype._hasDescendant=function(item){
	while(item=item._parent)
		if(item===this)return true;
}
gui.disableFocus=function(e){
	e.preventDefault();
	e.stopPropagation();
}
gui.disableElement=function(el){
	el.style.pointerEvents='none';
	el.addEventListener('focusin',gui.disableFocus);
	if(el===document.activeElement || el.contains(document.activeElement))
		document.activeElement.blur();
}
gui.enableElement=function(el){
	el.style.pointerEvents='';
	el.removeEventListener('focusin',gui.disableFocus);
}
gui.Bin.prototype.in=function(v){
	if(v===-1){
		gui.disableElement(this._outerElement);
	}else if(this._disabled){
		gui.enableElement(this._outerElement);
	}
}
//forced focus---------------
gui.Item.prototype.fcs=function(v){
	if(this._prop.in>0){
		if(v)this._content.focus();
		else this._content.blur();
	}
}
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// events
gui.preventDefault=function(e){e.preventDefault();}
//pointer events---------------
gui.POINTER_EVENTS={
	mousemove:'p',
	mousedown:'pd',
	mouseup:'pu',
	click:'pc',
	dblclick:'pcc'
};
gui.sendEventXY=function(e){
	if(!e.button){
		var item=this._item,x,y,r=item._content.getBoundingClientRect(),event=gui.POINTER_EVENTS[e.type];
		x=e.clientX-r.left;
		y=e.clientY-r.top;
		if(item._prop.on[event][0])x=Math.round2(x,item._prop.on[event][0]);
		if(item._prop.on[event][1])y=Math.round2(y,item._prop.on[event][1]);
		if(item['_lastX'+event]!==x || item['_lastY'+event]!==y){
			item._event(event,[x,y],true);
			item['_lastX'+event]=x;
			item['_lastY'+event]=y;
		}
	}
}
gui.sendMouseButtonEvent=function(e){
	if(e.button){
		var item=this._item,x,y,r=item._content.getBoundingClientRect();
		x=e.clientX-r.left;
		y=e.clientY-r.top;
		item._event(e.type==='mousedown'?'md':'mu',
			[e.button===1?2:(e.button===2?1:e.button),x,y]);
	}
}
//scroll events--------------
gui.checkSx=function(){
	var item=this._item,sx=gui.INFO.sx(item);
	if(item._prop.on.sx[0])sx=Math.round2(sx,item._prop.on.sx[0]);
	if(sx!==item._prop.sx){
		item._prop.sx=sx;
		item._event('sx',sx,true);
	}
}
gui.checkSy=function(){
	var item=this._item,sy=gui.INFO.sy(item);
	if(item._prop.on.sy[0])sy=Math.round2(sy,item._prop.on.sy[0]);
	if(sy!==item._prop.sy){
		item._prop.sy=sy;
		item._event('sy',sy,true);
	}
}
//loop events checking wh, xy, and whc----------------
gui.Item.prototype._checkProp=function(propName){
	var vals=gui.INFO[propName](this);
	// if either first or second value (widht, height or x, y) has changed, fire event
	if(!this._propOld[propName] || vals[0]!==this._propOld[propName][0] || vals[1]!==this._propOld[propName][1]){
		this._propOld[propName]=vals;
		this._event(propName,vals);
	}
}
//event functions------------
gui.EVENTS={
	v:{input:function(e){this._item._event('v',this._item._prop.v)}},
	sx:{scroll:gui.checkSx},
	sy:{scroll:gui.checkSy},
	o:null, //defined above
	fold:null, //defined in gui.Item.prototype.fold
	fcs:{"focus":function(e){this._item._event('fcs',1)},"blur":function(e){this._item._event('fcs',0)}},
	po:{"mouseenter":function(e){this._item._event('po',1)},"mouseleave":function(e){this._item._event('po',0)}},
	p:{"mousemove":gui.sendEventXY},
	pc:{"click":gui.sendEventXY},
	pcc:{"dblclick":gui.sendEventXY},
	pd:{"mousedown":gui.sendEventXY},
	pu:{"mouseup":gui.sendEventXY},
	md:{"mousedown":gui.sendMouseButtonEvent},
	mu:{"mouseup":gui.sendMouseButtonEvent},
	sw:{"mousewheel":function(e){if(e.wheelDeltaY)this._item._event('sw',e.wheelDeltaY>0?1:0)}},
	swh:{"mousewheel":function(e){if(e.wheelDeltaX)this._item._event('swh',e.wheelDeltaX>0?1:0)}},
	k:{"keydown":function(e){if(!e.repeat)this._item._event('k',e.key)}},
	ku:{"keyup":function(e){if(!e.repeat)this._item._event('ku',e.key)}},
};
gui.Item.prototype._event=function(key,val,ignoreFilter){
	var filter=this._prop.on[key];
	if(ignoreFilter 
		|| !filter.length
		|| filter.includes(val) 
		|| ((key==='md' || key==='mu') && filter.includes(val[0]))
	)this._sendMsg({[key]:val});
}
gui.Item.prototype.on=function(v){
	if(!v){
		v={};
		for(var e in this._on){
			v[e]=null;
		}
	}
	if(!this._on)this._on={};
	for(var e in v){
		this._on[e]=v[e];
		if(gui.EVENTS[e]){
			for(var jsListener in gui.EVENTS[e]){
				if(v[e]){
					((e==='sx'||e==='sy')?this._frame:
						(this===gui.rootContainer?document.body:
							(e==='fcs'?this._content:this._element)))
							.addEventListener(jsListener,gui.EVENTS[e][jsListener]);
					if(e==='md'||e==='mu'){ //cancel context menu
						(this===gui.rootContainer?document.body:this._element)
							.addEventListener('contextmenu',gui.preventDefault);
					}
				}else{
					((e==='sx'||e==='sy')?this._frame:
						(this===gui.rootContainer?document.body:this._element))
							.removeEventListener(jsListener,gui.EVENTS[e][jsListener]);
					if(e==='md'||e==='mu'){ //add back context menu
						(this===gui.rootContainer?document.body:this._element)
							.removeEventListener('contextmenu',gui.preventDefault);
					}
				}
				this._frame._item=this;
			}
		}else if(e==='xy'||e==='wh'||e==='whc'){
			if(v[e]){
				this._propWatch.add(e);
				gui.propWatch.add(this);
			}else{
				this._propWatch.delete(e);
			}
		}
	}
}
//////////////////////////////////////////////////////////////////////////////




//////////////////////////////////////////////////////////////////////////////
// additional bin options
addCSS(`
.controlTitle {cursor:pointer;user-select:none;display:inline-block;width:1em;height:1em;text-align:center;font-family:monospace;overflow:visible !important;border-radius:2px;border:solid 0.5px #ddd;margin-right:0.25em}
[fold="2"]>.title {position:relative !important;display:block}
[fold="2"]>.title:after {content:"...";padding:2px;}
[fold="2"]>.frame {display:none}
.controlFold:hover {background-color:#ddd}
[fold='1']>.title>.controlFold:before {content:'-'}
[fold='2']>.title>.controlFold:before {content:'+'}
.controlClose:hover {background-color:f33}
.controlClose:before {content:'×'}
`);
gui.Bin.prototype.fold=function(v){
	if(v && !this._manFold){
		const element=this._element,item=this;
		this._manFold=document.createElement('div');
		this._title.prepend(this._manFold);
		if(this._manClose)this._title.prepend(this._manClose);
		this._manFold.className='controlTitle controlFold';
		this._manFold.onclick=function(e){
			item._updateProp('fold',3-item._prop.fold);
			if(item._prop.on&&item._prop.on.fold){
				item._event('fold',item._prop.fold);
			}
		};
	}else if(!v && this._manFold){
		this._manFold.remove();
		delete this._manFold;
	}
}
gui.Bin.prototype._userClosed=function(){
	if(this._prop.on && this._prop.on.v && (this._prop.on.v.length===0 || this._prop.on.v.includes(null)))
		this._sendMsg({v:null});
	this._parent._removeChild(this);
}
gui.Bin.prototype.cls=function(v){
	if(v){
		const element=this._element,item=this;
		//------------close button------------
		this._manClose=document.createElement('div');
		this._title.prepend(this._manClose);
		this._manClose.className='controlTitle controlClose';
		this._manClose.onclick=function(){item._userClosed()};
	}else if(this._manClose){
		this._manClose.remove();
		delete this._manClose;
	}
}
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// additional button options
addCSS(`
[c='bin']:not(tr)[in="1"] {cursor:pointer;user-select:none;-moz-user-select:none;}
[btnin="0"] {pointer-events:none}
[c='btn'][in="0"] , [c='opt'][in="0"] , [c='hold'][in="0"] {opacity:.75;pointer-events:none}
`);
gui.Btn.prototype.in=function(v){
	if(v>0){
		this._setAttr('tabindex',0);
		// this._bind(this._boundTo);
	}else{
		this._setAttr('tabindex',null);
		// this._unbind();
	}
}
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// hot keys
gui.Item.prototype.keys=function(v){
	if(v==null || v.length==0){
		for(var k of this._prop.keys)
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
	if(!(e.target.isContentEditable && e.target._item._prop.in===1) && //this isn't text input
		!(e.target.constructor===HTMLInputElement && !e.target.disabled)){ //this isn't numeric input
		var item=gui.keys[e.key];
		if(item){
			if(item._exists()){
				e.preventDefault();
				e.stopPropagation();
				if(!e.repeat){
					if(e.type==='keydown'){
						if(item._prop.fold===2){				//fold
							item._updateProp('fold',1);
						}else if(item._prop.fold===1){		//unfold
							item._updateProp('fold',2);
						}else if(item._prop.in!==0 && item._prop.in!==-1){
							item._content.focus();			  //focus
							if(item._btnDown)item._btnDown();   //push button
						}
					}else if(e.type==='keyup' && item._btnUp){
						item._btnUp();
					}
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
// datetime
addCSS(`
[c='dt'] * {display:inline-block;vertical-align:middle}
[c='dt'] > .title:empty {width:0px;height:0px;overflow:hidden}
[c='dt'] > .title:not(:empty) {border-bottom:solid 1px var(--colorBorder);vertical-align:bottom;margin-top:inherit;margin-right:.75em}
[c='dt'] > .title:not(:empty):after {content:":"}
[c='dt'] > .content {display:inline-block}
[c='dt'][unit]:after {content: attr(unit);font-size:80%;padding-left:2px;vertical-align:bottom}
`)
gui.Dt=class extends gui.Num{
	_initContent(){
		this._element=document.createElement('div');									//element container (overflow:visible so that shapes/axes can show)
		this._frame=this._element;
		this._title=this._frame.appendChild(document.createElement('div'));				//title (this is where id/title goes)
		this._content=this._frame.appendChild(document.createElement('input'));			//content (includes value)
		this._content.type='datetime-local';
		this._content.disabled=true;
		this._parent._placeChildElement(this);
	}
	_initDefaults(prop){
		if(!('v' in prop))this._classDefaults.v=localTimestamp();
		super._initDefaults(prop);
	}
	_display(v,step=0,offset=0){
		if(step)v=offset+Math.round2(v-offset,step);
		if(step>=86400)v=(new Date(v*1000)).toJSON().substring(0,10);
		else if(step>=60)v=(new Date(v*1000)).toJSON().substring(0,16);
		else if(step>=1)v=(new Date(v*1000)).toJSON().substring(0,19);
		else if(step>=.1)v=(new Date(v*1000)).toJSON().substring(0,21);
		else if(step>=.01)v=(new Date(v*1000)).toJSON().substring(0,22);
		else v=(new Date(v*1000)).toJSON().substring(0,23);
		return v;
	}
	_adjustWidth(){}
	step(v){
		if(this._prop.step<0)this._prop.step*=-1;
		if('max' in this._prop)this._content.setAttribute('max',this._display(this._prop.max,this._prop.step));
		else this._content.removeAttribute('max');
		if('min' in this._prop)this._content.setAttribute('min',this._display(this._prop.min,this._prop.step));
		else this._content.removeAttribute('min');
		this._content.setAttribute('step',this._prop.step>=86400?this._prop.step/86400:this._prop.step);
		this.v(this._prop.v);
	}
	v(v){
		if(this._prop.step && this._prop.step>=86400)this._content.type='date';
		else this._content.type='datetime-local';
		super.v(v);
	}
	in(v){
		var c=this._content;
		c._removeListeners();
		if(v>0){
			c.removeAttribute('disabled');
			function send(){
				c._item._updateProp('v',Date.parse(c.value.length>10?c.value+'+00:00':c.value)/1000);
				c._item._sendMsg({v:c._item._prop.v});
			};
			c._listen('blur',send);
			c._listen('keypress',e=>{if(e.key=='Enter')send()});
		}else{
			c.setAttribute('disabled','');
		}
	}
}
gui.Dt.prototype._classDefaults={c:'dt',v:localTimestamp()};
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// timespan
addCSS(`
[c='time'] * {display:inline-block;vertical-align:middle}
[c='time'] > .title:empty {width:0px;height:0px;overflow:hidden}
[c='time'] > .title:not(:empty) {border-bottom:solid 1px var(--colorBorder);vertical-align:bottom;margin-top:inherit;margin-right:.75em}
[c='time'] > .title:not(:empty):after {content:":"}
[c='time'] > .content {display:inline-block}
[c='time'][unit]:after {content: attr(unit);font-size:80%;padding-left:2px;vertical-align:bottom}
`)
gui.Time=class extends gui.Num{
	_initContent(){
		this._element=document.createElement('div');									//element container (overflow:visible so that shapes/axes can show)
		this._frame=this._element;
		this._title=this._frame.appendChild(document.createElement('div'));				//title (this is where id/title goes)
		this._content=this._frame.appendChild(document.createElement('input'));			//content (includes value)
		// this._content.type='datetime-local';
		this._content.disabled=true;
		this._parent._placeChildElement(this);
		this._content.type='';
		this._content.setAttribute('pattern','(-)?(\\d+h)?[0-5]?\\d(m|(m[0-5]?\\d(\\.\\d+)?(s)?))?');
		this._content.oninput=function(){this.reportValidity()};
	}
	_display(v,step=0,offset=0){
		var h=0,m=0,display='';
		if(v>=3600){
			h=Math.trunc(v/3600);
			v=Math.abs(v-h*3600);
			display+=h+'h';
		}else if(step>=60){
			display='0h';
		}
		if(v>=60){
			m=Math.trunc(v/60);
			v-=m*60;
		}
		if(display)display+=m.toString().padStart(2,'0')+'m';
		else display+=m+'m';
		if(step<60){
			if(step&&step<1)v=v.toFixed(step.toString().split('.')[1].length);
			else{ //cut down to milliseconds
				let vstr=v.toString(),vstr3=v.toFixed(3);
				v=vstr.length>vstr3.length?vstr3:vstr;
			}
			if(v.split('.')[0].length===1)v='0'+v;
			display+=v.toString().padStart(2,'0')+'s';
		}
		return display;
	}
	_adjustWidth(size){
		this._content.setAttribute('size',size+1);
	}
	step(v){
		if(this._prop.step<0)this._prop.step*=-1;
		var helptext='Must be the following format: #h##m##.###s.\n';
		if('min' in this._prop)helptext+='Minimum value: '+this._display(this._prop.min)+'.\n';
		if('max' in this._prop)helptext+='Maximum value: '+this._display(this._prop.max)+'.\n';
		if('step' in this._prop)helptext+='Step size: '+this._display(this._prop.step)+'.\n';
		this._content.setAttribute('title',helptext);
		this.v(this._prop.v);
	}
	in(v){
		var c=this._content;
		if(v>0){
			c.removeAttribute('disabled');
			c.onchange=function(){
				if(this.reportValidity()){
					//parse hms into time
					var val=c.value,h=0,m=0,s=0;
					if(val.includes('h')){
						[h,val]=val.split('h');
						h=parseInt(h);
					}
					if(val.includes('m')){
						[m,s]=val.split('m');
						m=parseInt(m);
						s=parseFloat(s)||0;
					}
					c._item._updateProp('v',h*3600+m*60+s);
					c._item._sendMsg({v:c._item._prop.v});
				}
			};
		}else{
			c.setAttribute('disabled','');
		}
	}
}
gui.Time.prototype._classDefaults={c:'time',v:0};
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// holddown button
addCSS(`
[c='hold'] {text-align:center;display:inline-block;padding:.4em;color:var(--color1);border:1px solid rgba(0,0,0,0.2);background-color:var(--colorFalse);box-shadow: 0 0 5px -1px rgba(0,0,0,0.2);vertical-align:middle;}
[c='hold']:not(:empty),[select="0"]:not(:empty) {min-width:100px;border-radius:4px;}
[c='hold'][in]:empty {width:2em;height:2em;border-radius:2em;}
`)
gui.Hold=class extends gui.Btn{
	_btnDown(){this._boundTo._element.onmousedown();}
	_btnUp(){this._boundTo._element.onmouseup();}
	_bind(item){
		var thisItem=this;
		this._boundTo=item;
		if(this._unbind)this._unbind();
		if(this._prop)
			item._setAttr('in',this._prop.in);
		item._element.onmousedown=function(e){						//onmousedown behavior
			thisItem._updateProp('v',true);
			thisItem._sendMsg({v:true});
			// if(e)e.preventDefault();
		}
		item._element.onmouseup=function(){							//onmouseup behavior
			if(this._item._prop.v){
				thisItem._updateProp('v',false);
				thisItem._sendMsg({v:false});
			}
		}
		item._element.onmouseleave=this._element.onmouseup;
		this._unbind=function(){item._element.onmousedown=item._element.onmouseup=null;}
	}
	v(v){}
}
gui.Hold.prototype._classDefaults={c:'hold',v:false};
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// selectable options (checkboxes/radiobuttons)
addCSS(`
[c='opt'] {display:block;text-align:center}
[c='opt'] > .title {display:inline-block}
[c='opt']:not([v="true"]):before {content:"\\2610" " ";display:inline}
[c='opt'][v="true"]:before {content:"\\2611" " ";display:inline}
[c='opt'][grp]:not([v="true"]):before {content:"\\029be" " ";display:inline}
[c='opt'][grp][v="true"]:before {content:"\\029bf" " ";display:inline}
`)
gui.selectGroups={};
gui.Opt=class extends gui.Btn{
	_bind(item){
		var thisItem=this;
		this._boundTo=item;
		if(this._unbind)this._unbind();
		if(this._prop)
			item._setAttr('in',this._prop.in);
		item._element.onclick=function(){							//select/deselect behavior
			if(thisItem._prop.v){
				thisItem._sendMsg({v:false});
				thisItem._updateProp('v',false);
			}else{
				thisItem._sendMsg({v:true});
				thisItem._updateProp('v',true);
			}
		}
		this._unbind=function(){item._element.onclick=null;}
	}
	cap(v){
		super.cap(v);
		if((v===null||v===undefined)?this._prop.id:v)this._element.style.textAlign='left';
		else this._element.style.textAlign='center';
	}
	v(v){
		if(this._boundTo && this._boundTo!==this){
			this._boundTo._setAttr('v',v);
		}
		var grp=this._prop.grp;
		if(grp){
			var currentSelected=gui.selectGroups[grp];
			if(v){
				if(currentSelected && currentSelected!==this){
					currentSelected._updateProp('v',false);
				}
				gui.selectGroups[grp]=this;
			}else if(currentSelected===this){
				gui.selectGroups[grp]=undefined;
			}
		}
	}
	grp(v){}
}
gui.Opt.prototype._classDefaults={c:'opt',v:false};
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// doc (markup document: html, markdown)
addCSS(`
[c='doc'] > .content {white-space:normal;}
`);
gui.Doc=class extends gui.Txt{
	v(v){this.in(this._prop.in);}
	in(v){
		if(v>0){
			this._content.innerText=this._prop.v;
			gui.Txt.prototype.in.call(this,v); //TODO: change this to prior multiline text input
		}else if(this._content.getAttribute('contenteditable')){
			this._content.removeAttribute('contenteditable');
			if(this._prop.fmt=='mkdn'){
				this._content.innerHTML=gui.markdown(this._prop.v);
			}else{
				this._content.innerHTML=this._prop.v;
			}
		}
	}
	fmt(v){}
}
gui.Doc.prototype._classDefaults={c:'doc',v:''};
//////////////////////////////////////////////////////////////////////////////



//////////////////////////////////////////////////////////////////////////////
// win
addCSS(`
.glass {z-index:1;position:fixed;top:0px;left:0px;width:100vw;height:100vh;background-color:rgba(255,255,255,.5);pointer-events:all}
[c='win'] {z-index:1;position:absolute;top:50%;left:50%;transform:translate(-50%,-100%) !important;min-width:200;max-width:90vw;max-height:90vh;border:solid 1px gray;border-radius:4px;padding:0px;background-color:var(--color0);box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.5)}
[c='win']>.title {padding:5px; background:linear-gradient(#fff,#fff,#fff,#eee,#ddd)}
[c='win']>.frame {margin:1em}
`);
gui.disableAllUnderGlass=function(){
	//find top glass and disable everything under it
	var f=gui.rootContainer._frame,
		i=f.childElementCount,
		glassFound=false;
	while(i--){
		if(glassFound){
			gui.disableElement(f.children[i]);
		}else{
			if(f.children[i].className==='glass')
				glassFound=true;
			else
				gui.enableElement(f.children[i]);
		}
	}
}
gui.Win=class extends gui.Bin{
	_initContent(){
		this._element=document.createElement('div');
		this._title=this._element.appendChild(document.createElement('div'));
		this._frame=this._element.appendChild(document.createElement('div'));
		this._content=this._frame.appendChild(document.createElement('div'));
		this._parent._frame.appendChild(this._element);
		this._outerElement=this._element;
		document.activeElement.blur();
	}
	_beforeRemove(){
		if(this._glass)this._glass.remove();
		gui.disableAllUnderGlass();
	}
	mod(v){
		if(v && !this._glass){
			this._glass=this._parent._frame.insertBefore(document.createElement('div'),this._outerElement);
			this._glass.className='glass';
		}else if(!v && this._glass){
			this._glass.remove();
		}
		gui.disableAllUnderGlass();
	}
	i(v){
		var parent=this._parent;
		if(parent && parent._children[v]!==this){
			var myindx=parent._children.indexOf(this);
			if(myindx>-1)
				parent._children.splice(myindx,1);
			if(v<parent._children.length){
				parent._children.splice(v,0,this);
			}else{
				parent._children.push(this);
			}
			var insertBefore;
			for(var e of parent._frame.children){
				if(e!==this._outerElement && e.getAttribute('c')==='win' && e._item._getIndex()>v){
					insertBefore=e;
				}
			}
			if(insertBefore){
				parent._frame.insertBefore(this._outerElement,insertBefore._item._glass||insertBefore);
			}else{
				parent._frame.appendChild(this._outerElement);
			}
			if(this._glass)
				parent._frame.insertBefore(this._glass,this._outerElement);
			gui.disableAllUnderGlass();
		}
	}
	z(v){
		this._outerElement.style.zIndex=v;
		if(this._glass)this._glass.style.zIndex=v;
	}
}
gui.Win.prototype._classDefaults={c:'win',v:[]};
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// one (tabs)
addCSS(`
[c="one"] > .frame > .content > * {border:none !important}
[c="one"] > .frame > .content > *:not([fold="1"]) {display:none}
[c="one"] > .frame > .content > * > .title {display:none}
[c="one"] > .frame {border: solid 1px gray;background-color:#fff}
.tabTitles {margin-top:5px;z-index:1;margin:4px}
.tabTitles > span {border:solid 1px gray;border-radius:3px;font-size:70%;font-family:Arial;margin:4px;padding-left:10px;padding-right:10px;cursor:pointer;background-color:var(--colorHead)}
.visibleTabTitle {border-bottom:none !important;font-weight:bold;padding-bottom:5.5px;background-color:#fff !important;border-radius: 3px 3px 0px 0px !important;}
`);
gui.One=class extends gui.Bin{
	_switchTabs(child){
		if(this._visibleTab){
			this._visibleTab._tabTitle.className='';
			this._visibleTab._updateProp('fold',null);
		}
		this._visibleTab=child;
		child._tabTitle.className='visibleTabTitle';
	}
	_updateTabTitles(){
		var child,tabTitle;
		if(!this._tabTitles){
			this._tabTitles=this._element.insertBefore(document.createElement('div'),this._frame);
			this._tabTitles.className='tabTitles';
		}else{
			this._tabTitles.innerHTML='';
		}
		for(child of this._children){
			tabTitle=this._tabTitles.appendChild(document.createElement('span'));
			tabTitle.innerText=child._titleText.innerText;
			tabTitle._item=child;
			child._tabTitle=tabTitle;
			if(child===this._visibleTab)
				tabTitle.className='visibleTabTitle';
			tabTitle.onclick=function(){
				this._item._updateProp('fold',1);
			};
		}
	}
	//TODO: add remove method that gets rid of tab title
	_newChild(prop){
		var type=gui.getType(prop);
		// only add child if it's a bin
		if(!type || type==gui.Bin){
			// check if this is a visible tab
			var visibleTab = prop.fold===1 || !this._visibleTab;
			delete prop.fold;
			// create child
			var child=new gui.Bin(prop,this);
			if(!this._children.includes(child))
				this._children.push(child);
			// remap child's fold function
			child.fold=function(v){if(v===1)this._parent._switchTabs(this)};
			//update tab titles
			this._updateTabTitles();
			// if this is a visible tab, switch to it
			if(visibleTab){
				this._switchTabs(child);
				child._setAttr('fold',1);
			}
		}
	}
}
gui.One.prototype._classDefaults={c:'one',v:[]};
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// grid
addCSS(`
[c="grid"] > .title:not(empty) {border-bottom:solid 1px var(--colorBorder);flex:none}
[c="grid"] {display:flex;flex-direction:column}
[c="grid"] > div {overflow:auto;flex:1 1 auto}
[c="grid"] > .frame {max-height: 400px}
tr {margin:0}
table {border-spacing:0;border-collapse:collapse;overflow:scroll !important}
th {background:var(--colorHead);position:sticky;top:0;font:inherit;z-index:2}
td {background-clip:padding-box}
td,th {padding-right:1em; vertical-align:text-bottom}
td.title:empty {display:table-cell}
`);
gui.Grid=class extends gui.Bin{
	_initContent(){
		this._element=document.createElement('div');
		this._title=this._element.appendChild(document.createElement('div'));
		this._frame=this._element.appendChild(document.createElement('div'));
		this._frame.style.overflow='auto';
		this._content=this._frame.appendChild(document.createElement('table'));
		this._headerRow=this._content.appendChild(document.createElement('tr'));
		this._headerRow2=this._content.appendChild(document.createElement('tr'));
		this._parent._placeChildElement(this);
	}
	_newChild(prop){
		var type=gui.getType(prop);
		// only add child if it's a bin, but add it as new GridRow()
		if(!type || type==gui.Bin){
			var child=new gui.GridRow(prop,this);
			if(!this._children.includes(child))
				this._children.push(child);
		}
	}
	_floatRow(e){
		var translate=this.scrollTop?"translate(0,"+(this.scrollTop-3)+"px)":null;
		var p=this.firstChild.firstChild.querySelectorAll('td');
		for(var i in p)if(p[i] && p[i].style){
			p[i].style.transform = translate;
		}
	}
	// head(v){
	// 	this._headerRow.innerHTML='';
	// 	if(v && v.length){
	// 		var th,colspan;
	// 		this._headerRow.appendChild(document.createElement('th'));
	// 		this._headerRow.appendChild(document.createElement('th'));
	// 		for(var i=0;i<v.length;i++){
	// 			th=this._headerRow.appendChild(document.createElement('th'));
	// 			th.innerHTML=v[i];
	// 			colspan=1;
	// 			while(v[i]==v[i+1]){
	// 				colspan++;
	// 				i++;
	// 			}
	// 			if(colspan>1)th.colSpan=colspan;
	// 		}
	// 	}
	// }
	rows(v){
		var row=(new Array(this._prop.cols||1)).fill(0);
		while(v>this._children.length){
			this._newChild(row.map(x=>[]));
		}
	}
	cols(v){
		for(var row of this._children){
			while(v>row._children.length){
				row._newChild([]);
			}
		}
	}
};
gui.Grid.prototype._classDefaults={c:'grid',v:[]};
gui.GridRow=class extends gui.Bin{
	_initContent(){
		this._element=document.createElement('tr');				//e.v is a sub-element where content is displayed
		this._frame=this._element;
		this._title=this._element.appendChild(document.createElement('td'));
		this._title2=this._element.appendChild(document.createElement('td'));
		this._content=this._element;
		this._parent._placeChildElement(this);
	}
	_placeChildElement(child){
		var td=this._content.appendChild(document.createElement('td'));
		td.appendChild(child._element);
		child._outerElement=td;
	}
};
gui.GridRow.prototype._classDefaults={c:'bin',v:[]};
//////////////////////////////////////////////////////////////////////////////
