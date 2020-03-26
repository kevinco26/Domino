import React, { Component } from 'react';
import socketIOClient from "socket.io-client";
import Domino from './Domino.js';
import logo from './logo.svg';
import './App.css';

// Is here the right place?
// how to handle refresh different socket?
let socket = socketIOClient();
class App extends Component {

  constructor() {
    super();
    this.state = {
      roomToJoin: "",
      isDomino: false,
      joinedRoom: false,
      teams: {},
      playerToStart: null,
      playerName: ""
    };
  }
  componentDidMount() {
    socket.on("BeginDomino", (data) => {
      this.setState({ isDomino: true, teams: data.teams, playerToStart: data.playerToStart });
    });
  }

  handleChange = (event) => {
    this.setState({ roomToJoin: event.target.value });
  }

  handleChangePlayerName = (event) => {
    this.setState({ playerName: event.target.value });
  }

  handleSubmit = (event) => {
    if (this.state.roomToJoin == "" || this.state.playerName == "") {
      alert("Please enter a non-empty room and a non-empty player name");
      event.preventDefault();
      return;
    }
    socket.emit("join", this.state.roomToJoin, this.state.playerName); // maybe not the best place (What if refresh)
    console.log("You just joined this room: " + this.state.roomToJoin);
    this.setState({ joinedRoom: true });
    event.preventDefault();
  }

  render() {
    if (this.state.isDomino && this.state.teams != {}) {
      return <Domino socket={socket} teams={this.state.teams} playerToStart={this.state.playerToStart} playerName={this.state.playerName} />
    }
    return (
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <form onSubmit={this.handleSubmit}>
            <label>
              Join a room:
              <input type="text" value={this.state.roomToJoin} onChange={this.handleChange} />
            </label>
            <input type="submit" value="Submit" />
          </form>
          <label>
            Please enter your username
            (if disconnected from an existing game, please choose the same username)
              <input type="text" value={this.state.playerName} onChange={this.handleChangePlayerName} />
          </label>
          {this.state.joinedRoom && <p>Waiting for more people to join room: {this.state.roomToJoin}</p>}
        </header>
      </div >
    );
  }
}

export default App;
