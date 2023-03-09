# u1.js

u1js is a web-browser JavaScript library for display and interacting with web applications using [UINL](https://uinl.github.io) as the UI interaction language.


<img src="https://uinl.github.io/img/icon.png" width=250 align=right>
Is u1js just another JS framework?

- No, although you can use it as such.
- u1js is an API-to-GUI interpreter for [UINL](https://uinl.github.io).
  - UINL (User Interface object-Notation Language) is a machine-readable format for specifying user-interface changes.
  - Main focus of UINL is in providing a functionally-equivalent task experience for human and computational users alike.
In its focus to make human software usable by machine agents, UINL aims to eliminate non-task-essential design choices (e.g. font type/size may be irrelevant for many task types), leaving those to be optionally specified via customizable templates (e.g. CSS).


Is u1js just for client-side applications?

- No. You can use u1js without any additional client-side code to connect to a UINL-compliant server-side application (via HTTP or websockets).



### Hello World example with client-side JavaScript application code:

        <html><head><script src="https://cdn.jsdelivr.net/gh/uinl/u1js/u1.min.js"></script><script>
            function userEvent(event){
                if(event.t===0){ // on handshake (event.t is time of event)
                    app.display({
                        value:[ "Hello World!" ]
                    });
                }
            }
        </script></head><body></body></html>


### Hello World example with server-side application code, using the POST method to send user events:

        <html><head><script src="https://cdn.jsdelivr.net/gh/uinl/u1js/u1.min.js"></script><script>
            const app = {
                location: 'https://uinldemo.ue.r.appspot.com/'
            }
        </script></head><body></body></html>


### Hello World example with server-side application code, using the GET method to send user events:

        <html><head><script src="https://cdn.jsdelivr.net/gh/uinl/u1js/u1.min.js"></script><script>
            const app = {
                method: 'GET',
                location: 'https://uinl.github.io/u1js/helloworld.json'
            }
        </script></head><body></body></html>



More details on UINL may be found at https://uinl.github.io (repo at https://github.com/uinl/uinl).



## If you are referencing u1js from your webpage, you can use jsdelivr CDN:

### use this during development

* https://cdn.jsdelivr.net/gh/uinl/u1js/u1.min.js

### use a specific version reference in production (to make sure your code remains stable)

* https://cdn.jsdelivr.net/gh/uinl/u1js@0.1/u1.min.js
