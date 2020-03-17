import React, { Component } from 'react';
import socketIOClient from "socket.io-client";
import Domino from './Domino.js';
import logo from './logo.svg';
import './App.css';

// Is here the right place?
// how to handle refresh different socket?
let socket = socketIOClient("http://127.0.0.1:8080");;
class App extends Component {

  constructor() {
    super();
    this.state = {
      isDomino: false,
      teams: {}
    };
  }
  componentDidMount() {
    socket.emit("join", "cuarto1"); // maybe not the best place (What if refresh)
    socket.on("BeginDomino", (data) => {
      this.setState({ isDomino: true, teams: data.teams });
    });
  }

  render() {
    if (this.state.isDomino && this.state.teams != {}) {
      return <Domino socket={socket} teams={this.state.teams} />
    }
    return (
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <button  >
            Waiting for more players...
          </button>
          <p>Current in {this.state.data} lobby.. {this.state.isDomino}</p>
        </header>
      </div >
    );
  }
}

export default App;
