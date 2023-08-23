from bottle import run, route, template,static_file

@route('/pages/<filename:path>')
def serve_static(filename):
    return static_file(filename, root='./pages/')
@route('/')
def index():
    return static_file('index.html',root='./pages/')


run(host='localhost',port=8080,reloader=True,debug=True)