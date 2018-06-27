import React, { Component, Fragment } from 'react';
import { makeRequest } from 'utils';
import { url, messages } from 'config';

import { withAuth } from 'auth';

import {
  GET_ACTIVE_HACKATHON,
  CREATE_HACKATHON,
  SEND_CHALLENGE_ANSWER,
  CREATE_TEAM,
  DELETE_TEAM,
  START_HACKATHON,
  FINISH_HACKATHON,
  DELETE_HACKATHON,
  GET_RESULTS,
} from 'constants/action-types/store';

import ws from './ws';

import StatusMessage from 'components/StatusMessage';

const defaultState = {
  activeHackathon: null,
  isLoading: false,
};

const AppContext = React.createContext(defaultState);

const withStore = Component => function WrappedComponent(props) {
  return (
    <AppContext.Consumer>
      {value => <Component
        {...props}
        store={value.state}
        storeActions={value.actions}
      />}
    </AppContext.Consumer>
  )
};

class AppStateProvider extends Component {
  state = {
    ...defaultState,
    showStatusMessage: false,
  };

  componentDidMount() {
    this.getActiveHackathon();
    ws.onmessage = this.handleWsBroadcast;
  };

  reduce(payload, action) {
    switch(action) {
      case GET_ACTIVE_HACKATHON:
      case CREATE_HACKATHON:
        this.setState({ activeHackathon: payload });
      break;
      case GET_RESULTS:
      case SEND_CHALLENGE_ANSWER:
        this.setState({
          activeHackathon: {
            ...this.state.activeHackathon,
            ...{
              results: {
                ...this.state.activeHackathon.results,
                ...payload,
              },
            },
          },
        });
      break;
      case CREATE_TEAM:

        // TODO ::: About this case there is a todo in root/ws/uws-server.js
        if (this.state.activeHackathon.teams.some(({ _id }) => _id === payload._id )) return;

        this.setState({
          activeHackathon: {
            ...this.state.activeHackathon,
            teams: [
              ...this.state.activeHackathon.teams,
              payload,
            ],
          },
        });
      break;
      case DELETE_TEAM:
        this.setState({
          activeHackathon: {
            ...this.state.activeHackathon,
            ...payload.changes,
          },
        });
      break;
      case START_HACKATHON:
        this.setState({
          activeHackathon: {
            ...this.state.activeHackathon,
            ...payload,
          },
        });
      break;
      case FINISH_HACKATHON:
        this.setState({
          activeHackathon: {
            ...this.state.activeHackathon,
            ...payload,
          },
        });
      break;
      case DELETE_HACKATHON:
        this.setState({ activeHackathon: null });
      break;
      default: break;
    }
  }

  async handleResponse(request, action) {
    this.setState({ isLoading: true });
    const response = await request;

    if (response && response.errorMessage) {
      this.showError(response.errorMessage);
      return false;
    }

    this.reduce(response, action);

    this.setState({
      isLoading: false,
      showStatusMessage: false,
    });
  }

  showError(message) {
    this.setState({
      isLoading: false,
      showStatusMessage: true,
      statusMessage: { errorMessage: message },
    });
  }

  getActiveHackathon = async _ => this.handleResponse(
    makeRequest(`${url.base_url}${url.hackathons}`, 'GET'),
    GET_ACTIVE_HACKATHON,
  );

  createHackathon = async data => this.handleResponse(
    makeRequest(`${url.base_url}${url.hackathons}`, 'POST', data),
    CREATE_HACKATHON,
  );

  createTeam = async data => this.handleResponse(
    makeRequest(`${url.base_url}${url.team}`, 'POST', data),
    CREATE_TEAM,
  );

  deleteTeam = async teamId => this.handleResponse(
    makeRequest(`${url.base_url}${url.team}/${teamId}`, 'DELETE'),
    DELETE_TEAM,
  );

  startHackathon = async _ => this.handleResponse(
    makeRequest(`${url.base_url}${url.start_hackathon}`, 'POST'),
    START_HACKATHON,
  );

  updateResults = async _ => this.handleResponse(
    makeRequest(`${url.base_url}${url.get_results}`, 'GET'),
    GET_RESULTS,
  );

  finishHackathon = async _ => {
    if (!this.state.activeHackathon.started) {
      this.showError('Bro You can\'t finish something that hasn\'t been started!');
      return false;
    }

    this.handleResponse(
      makeRequest(`${url.base_url}${url.finish_hackathon}`, 'POST'),
      FINISH_HACKATHON,
    );
  };

  deleteHackathon = async _ => {
    this.handleResponse(
      makeRequest(`${url.base_url}${url.hackathons}`, 'DELETE'),
      DELETE_HACKATHON,
    );
  };

  sendChallengeAnswer = async data => {

    if (this.state.activeHackathon.finished) {
      this.showError('Hackathon already has finished!');
      return false;
    }

    this.handleResponse(
      makeRequest(`${url.base_url}${url.challenge_answer}`, 'POST', data),
      SEND_CHALLENGE_ANSWER,
    );
  }

  handleWsBroadcast = ({ data }) => {
    const { type, payload } = JSON.parse(data);

    const {
      authState: {
        isTeamMember,
        isAdmin,
        team,
      },
      authActions: {
        logout,
      },
    } = this.props;

    switch (type) {
      case SEND_CHALLENGE_ANSWER:
        const broadcasterId = Object.keys(payload)[0];

        if ((isTeamMember && broadcasterId === team._id) || isAdmin) {
          this.updateResults();
          return;
        }
      break;
      case DELETE_TEAM:
        if (isTeamMember && team._id === payload.teamId) {
          alert(messages.deletedTeamAlert);
          logout();
        };
      break;
      default: break;
    }

    this.reduce(payload, type);
  };

  handleStatusMessageClose = _ => this.setState({ showStatusMessage: false });

  render() {

    const {
      state: { showStatusMessage, statusMessage },
      state,
      getActiveHackathon,
      createHackathon,
      handleStatusMessageClose,
      sendChallengeAnswer,
      createTeam,
      startHackathon,
      finishHackathon,
      deleteHackathon,
      deleteTeam,
    } = this;

    return(
      <Fragment>
        {showStatusMessage && <StatusMessage
          statusData={statusMessage}
          handleClose={handleStatusMessageClose}
        />}
        <AppContext.Provider value={{
          state,
          actions: {
            getActiveHackathon,
            createHackathon,
            sendChallengeAnswer,
            createTeam,
            startHackathon,
            finishHackathon,
            deleteHackathon,
            deleteTeam,
          },
        }}>
          {this.props.children}
        </AppContext.Provider>
      </Fragment>
    );
  }
}

export { withStore };

export default withAuth(AppStateProvider);
