from bottle import static_file, route, run, template
import sqlite3

@route('/')
def index():
    return static_file('index.html', root='')
#New Mods
@route('/mods')
def mods():
    conn = sqlite3.connect('data/content.db')
    c = conn.cursor()
    c.execute("SELECT id, steamid, name, url FROM mods")
    result = c.fetchall()
    c.close()
    output = template('mods', rows=result)
    return output
#New Assets
@route('/assets')
def assets():
    conn = sqlite3.connect('data/content.db')
    c = conn.cursor()
    c.execute("SELECT id, steamid, name, url FROM assets")
    result = c.fetchall()
    c.close()
    output = template('assets', rows=result)
    return output

run(host='localhost',port=5150, reloader=True, debug=True)