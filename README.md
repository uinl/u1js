# stapjs
UINL interpreter JS library

        <html><head><script src="https://cdn.jsdelivr.net/gh/uinl/u1js/u1.min.js"></script><script>
        var app = {
            start: function(){
                app.display([ "Hello, World!" ]);
            }
        }
        </script></head><body></body></html>


<img src="https://uinl.github.io/img/uinl-icon.png" width=250 align=right>
UINL (User Interface object-Notation Language) is a machine-readable format for specifying user-interface changes.

More details on UINL may be found at https://github.com/uinl/uinl

u1js is a javascript library for interpreting UINL messages and displaying them in a web-browser.

Sample tasks that employ u1js may be found at https://github.com/uinl/uinl/tree/master/tasks/js


## If you are referencing u1js from your webpage, you can use jsdelivr CDN:

### use this during development

* https://cdn.jsdelivr.net/gh/uinl/u1js/u1.js

or minified

* https://cdn.jsdelivr.net/gh/uinl/u1js/u1.min.js

### use a specific version reference in production (to make sure your code remains stable)

* https://cdn.jsdelivr.net/gh/uinl/u1js@1.0/u1.js

or minified

* https://cdn.jsdelivr.net/gh/uinl/u1js@1.0/u1.min.js
