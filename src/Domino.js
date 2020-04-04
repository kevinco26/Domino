import React, { Component } from 'react';
import axios from 'axios';
import './App.css';

class Domino extends Component {
    constructor() {
        super();
        this.state = {
            pieces: [],
            board: [],
            currentPlayingPiece: {},
            nextPlayer: null,
            roundOver: false,
            roundNumber: 0,
            isRoundTrancated: false,
            team1Score: 0,
            team2Score: 0,
        };
    }
    componentDidMount() {

        if (this.state.board.length == 0) {
            // initial refresh of board
            this.getBoard();
        }

        // refresh is round over
        this.getIfRoundIsOverFromServer();

        // whenever we receive the refresh board event from server, update the local's board state
        this.props.socket.on("RefreshBoard", (data) => {

            this.removeUserPiece(data.pieceIntroduced);
            this.setState({ board: data.board, nextPlayer: data.nextPlayer });
            if (data.isTrancated) {
                // 0 is not a team, meaning it was un tranque
                this.endRound(0);
                this.setState({ isRoundTrancated: true });
                return;
            }

        });

        this.props.socket.on("BeginNewRound", (data) => {
            this.setState({ board: data.board, nextPlayer: data.playerToStart, pieces: [], currentPlayingPiece: {}, roundOver: false, roundNumber: data.roundNumber, isRoundTrancated: false });

        });

        this.props.socket.on("RoundOver", (data) => {
            this.setState({ team1Score: data.scores["team1"], team2Score: data.scores["team2"] })

            // flag round is over.
            this.setState({ roundOver: true });
        });
    }

    removeUserPiece(piece) {
        if (piece == null) {
            return;
        }
        // they havent gotten their initial pieces
        // maybe do it with some other flag later.. isRoundStarted
        if (this.state.pieces.length === 0) {
            return;
        }
        var index = this.state.pieces.findIndex(p => (p.top.value == piece.top.value && p.bottom.value == piece.bottom.value) || (p.top.value == piece.bottom.value && p.bottom.value == piece.top.value));
        if (index !== -1) {
            this.state.pieces.splice(index, 1);
            console.log(piece);
            console.log("piece removed")
        }
        if (this.state.pieces.length === 0) {
            // At this point, this current player just won so call endround function with this' player's team number
            this.endRound(this.props.teams[this.props.playerName]);
        }
    }
    render() {
        return (
            <div className="App">
                Hello and welcome to the Domino Board. &#127114;
                You are in team: {this.props.teams[this.props.playerName]}
                <br></br>
                Your name: {this.props.playerName}
                <br></br>
                {this.state.nextPlayer && <p>It's {this.state.nextPlayer}'s turn</p>}
                {this.props.playerName == this.state.nextPlayer && <p>It's your turn</p>}
                <br></br>
                {this.state.pieces.length == 0 && <button onClick={this.getPieces}>Click to get pieces</button>}
                <br></br>
                {<button onClick={this.noAvailableMoves}>Click to pass (if no available moves)</button>}
                <br></br>
                Your pieces are: {
                    this.state.pieces.map((piece) => <li><button onClick={this.playPiece.bind(this, piece)}>{piece.top.value} | {piece.bottom.value}</button></li>)}
                {this.state.roundOver && <p>Round over! Round's scores{this.state.isRoundTrancated && <p>(Locked game)</p>} Team 1 score: {this.state.team1Score}. Team 2 score: {this.state.team2Score} </p>}
                <div style={{ marginTop: "25px" }}>
                    The board: <br></br> <br></br><br></br><br></br>
                    {
                        this.state.board.map(function (piece) {
                            //Use style from classes
                            var isDouble = piece.top.value === piece.bottom.value;
                            return (
                                // probably a better way of handling the white space
                                <button style={isDouble ? { marginRight: "-20px", marginLeft: "-20px", transform: "rotate(90deg)" } : { marginRight: "1px", marginLeft: "1px" }} disabled={true}>
                                    <button style={isDouble ? { transform: "rotate(-90deg)", } : {}} onClick={this.playPieceOnBoard.bind(this, piece.top, "left")}>
                                        <span style={piece.top.open ? { color: "#2fd44b" } : {}}>{piece.top.value}</span>
                                    </button>
                                    |
                                    <button style={isDouble ? { transform: "rotate(-90deg)", } : {}} onClick={this.playPieceOnBoard.bind(this, piece.bottom, "right")}>
                                        <span style={piece.bottom.open ? { color: "#2fd44b" } : {}}>{piece.bottom.value}</span>
                                    </button>
                                </button>)
                        }, this)
                    }
                </div>
                <div style={{ marginTop: "50px" }}>
                    {this.state.roundOver && <button onClick={this.readyUp}>Click to ready up for next round</button>}
                </div>
            </div >
        );
    }

    readyUp = () => {
        // ready up next round
        this.props.socket.emit("ReadyUp", this.props.playerName);
    }

    getPieces = () => {
        console.log("pieces");
        axios.get(`/pieces?clientId=${this.props.socket.id}`).then(response => {
            console.log(response);
            this.setState({ pieces: response.data });
        })
    }

    getBoard() {
        axios.get(`/board?clientId=${this.props.socket.id}`).then(response => {
            console.log(response);
            this.setState({ board: response.data });
        })
    }

    getIfRoundIsOverFromServer() {
        axios.get(`/isRoundOver?clientId=${this.props.socket.id}`).then(response => {
            console.log(response);
            this.setState({ roundOver: response.data.isRoundOver, team1Score: response.data.team1Score, team2Score: response.data.team2Score });
        })
    }

    canPlayerPass() {
        let leftOpenEnd = this.state.board[0].top.value;
        let rightOpenEnd = this.state.board[this.state.board.length - 1].bottom.value;
        console.log("left open end: " + leftOpenEnd);
        console.log("right open end: " + rightOpenEnd);

        let pieceIndex = this.state.pieces.findIndex(p =>
            (p.top.value == leftOpenEnd || p.bottom.value == leftOpenEnd) ||
            (p.top.value == rightOpenEnd || p.bottom.value == rightOpenEnd));
        if (pieceIndex != -1) {
            console.log("Cannot pass, you can play a piece!")
            console.log(this.state.pieces[pieceIndex]);
            return false;
        }
        return true;
    }

    endRound = (winningTeam) => {
        this.props.socket.emit("endRound", winningTeam);
    }

    noAvailableMoves = () => {
        // check if the player really can't pass... 
        // also check if its the player's turn.. maybe we can put this button only if its the player's turn
        if (this.state.nextPlayer == null && this.props.playerToStart != this.props.playerName) {
            console.log("Cannot play because its not your turn");
            return;
        }
        else if (this.state.nextPlayer != null && this.state.nextPlayer != this.props.playerName) {
            console.log("Cannot play because its not your turn");
            return;
        }
        if (this.canPlayerPass()) {
            this.props.socket.emit("Pass")
        }
        else {
            console.log("cannot pass because you have available moves")
        }
    }

    playPiece = (piece) => {
        console.log("PLayer that should start");
        console.log(this.state.nextPlayer);
        console.log(this.props.playerToStart);
        // we have the playerToStart because the first round/piece does not get emmitted from the server rather passed from the App.js component
        // so we must have this playertostart variable hanging around here.
        if (this.state.nextPlayer == null && this.props.playerToStart != this.props.playerName) {
            console.log("Cannot play");
            this.setState({ currentPlayingPiece: null });
            return;
        }
        else if (this.state.nextPlayer != null && this.state.nextPlayer != this.props.playerName) {
            console.log("Cannot play");
            this.setState({ currentPlayingPiece: null });
            return;
        }
        // if the board is 0 and the piece is 6,6 in the first round, allow it.
        // in subsequent rounds, the nextplayer wont be null. meaning we will always check if its the player's turn.
        if (this.state.board.length == 0) {
            if (this.state.roundNumber == 0 && piece.top.value != 6 && piece.bottom.value != 6) {
                console.log("Cannot play if its not 6-6 on the first round!")
            }
            else {
                this.props.socket.emit("PlayPiece", piece, null);
            }
        }
        else {
            console.log("You want to play piece.. Please choose a side... if possible");
            console.log(piece);
            this.setState({ currentPlayingPiece: piece });
        }
    }

    // halfPiece since we are only passing either the top or the bottom and verifying that the half piece the user clicked is open
    playPieceOnBoard = (halfPiece, direction) => {
        halfPiece.direction = direction;
        console.log("direction:" + direction);
        console.log("halfpiece (you clicked) on: ")
        console.log(halfPiece);
        if (!halfPiece.open) {
            console.log("invalid place to put a piece as the half piece is not open");
            this.setState({ currentPlayingPiece: null });
            return;
        }
        else {

            if (this.state.currentPlayingPiece != null &&
                (this.state.currentPlayingPiece.top.value == halfPiece.value || this.state.currentPlayingPiece.bottom.value == halfPiece.value)) {
                console.log("You are allowed to play!");
                console.log("state current playing piece:")
                console.log(this.state.currentPlayingPiece);
                this.props.socket.emit("PlayPiece", this.state.currentPlayingPiece, halfPiece)
                this.setState({ currentPlayingPiece: null });
            }
        }
    }
}

export default Domino;
