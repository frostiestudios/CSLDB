import sqlite3
import pandas as pd
import plotly.graph_objs as go
from plotly.subplots import make_subplots
import socket
import os
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler
from appJar import gui
import webbrowser
import json

with open('server/csldb.json', 'r') as f:
    data = json.load(f)
pop = data['city']['population-entries']
cityname = ['city']
print(cityname)
print("Updated")


def openbrowser(btn):
    print(f"Opening server in browser")
    host_name = socket.gethostbyname(socket.gethostname())
    port_number = 5151
    webbrowser.open(f"http://{host_name}:{port_number}/server/")


def server(btn):
    host_name = socket.gethostbyname(socket.gethostname())
    port_number = 5151
    # Create an HTTP server
    httpd = HTTPServer((host_name, port_number), SimpleHTTPRequestHandler)
    # Start the server in a separate thread
    server_thread = threading.Thread(target=httpd.serve_forever)
    server_thread.start()
    app.setLabel("SL", f"Server: http://{host_name}:{port_number}")
    app.setLabel("SS", "Online")
    print("Server started at http://{}:{}/server/".format(*httpd.socket.getsockname()))


def update():
    df = pd.DataFrame(pop)
    fig = make_subplots(
        rows=2, cols=1,
        shared_xaxes=True,
        vertical_spacing=0.03,
        specs=[[{"type": "table"}],
               [{"type": "scatter"}]]
    )
    fig.add_trace(
        go.Table(
            header=dict(
                values=list(df.columns)
            ),
            cells=dict(
                values=[df[col] for col in df.columns]
            )
        )
    )
    fig.write_html("server/index.html")


def tfunc():
    print("Toolbar")
    if tools == "Open In Browser":
        print(f"Opening server in browser")
        host_name = socket.gethostbyname(socket.gethostname())
        port_number = 5151
        webbrowser.open(f"http://{host_name}:{port_number}/server/")


tools = ["Start", "Open In Browser"]

app = gui("CSLDB", "400x200", useTtk=True)
app.addToolbar(tools, tfunc)
app.setBg("White")

app.startLabelFrame("Server Commands", 1, 1)
app.addButton("Server", server)
app.addButton("Open Browser", openbrowser)
app.addButton("Update", update)
app.stopLabelFrame()

app.startLabelFrame("Server Settings", 1, 2)
app.addLabel("S3L")
app.addLabel("S3S")
app.stopLabelFrame()

app.startLabelFrame("Server Location", 2, 1)
app.addLabel("SL", "Server:", 1, 1)
app.stopLabelFrame()

app.startLabelFrame("Server Status", 2, 2)
app.addLabel("SS", "Status", 1, 1)
app.go()
