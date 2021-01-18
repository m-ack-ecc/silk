import React from 'react';
import PropTypes from 'prop-types';
import {Card, CardContent, CardTitle, Icon} from '@eccenca/gui-elements';
import silkStore from "../api/silkStore";
import ExecutionReport from "./ExecutionReport";

/**
 * Displays a workflow execution report.
 */
export default class WorkflowExecutionReport extends React.Component {

  constructor(props) {
    super(props);
    this.displayName = 'WorkflowExecutionReport';
    this.state = {
      executionReport: {
        taskReports: {}
      },
      selectedNode: null
    };
  }

  componentDidMount() {
    this.loadExecutionReport();
  }

  componentDidUpdate(prevProps) {
    if (this.props.project !== prevProps.project ||
        this.props.task !== prevProps.task ||
        this.props.time !== prevProps.time) {
      this.loadExecutionReport();
    }
  }

  loadExecutionReport() {
    this.props.diStore.retrieveExecutionReport(
        this.props.baseUrl,
        this.props.project,
        this.props.task,
        this.props.time)
        .then((report) => {
          this.setState({
            executionReport: report.value
          });
        })
        .catch((error) => {
          console.log("Loading execution report failed! " + error); // FIXME: Handle error and give user feedback. Currently this is done via the activity status widget
        });
  }

  render() {
    return  <div className="mdl-grid mdl-grid--no-spacing">
              <div className="mdl-cell mdl-cell--2-col">
                <Card className="silk-report-card">
                  <CardTitle>
                    Tasks
                  </CardTitle>
                  <CardContent>
                    <ul className="mdl-list">
                      { Object.entries(this.state.executionReport.taskReports).map(e => this.renderTaskItem(e[0], e[1])) }
                    </ul>
                  </CardContent>
                </Card>
              </div>
              <div className="mdl-cell mdl-cell--10-col">
                { this.renderReport(this.state.selectedNode) }
              </div>
            </div>
  }

  renderTaskItem(nodeId, report) {
    return <li key={nodeId} className="mdl-list__item mdl-list__item--two-line silk-report-list-item" onClick={() => this.setState({selectedNode: nodeId})} >
             <span className="mdl-list__item-primary-content">
               { report.label } { (report.task.id !== nodeId) ? '(' + nodeId + ')' : ''}
               { this.renderTaskDescription(report) }
             </span>
             <span className="mdl-list__item-secondary-content">
               { this.renderTaskIcon(report) }
             </span>
           </li>
  }

  renderTaskDescription(report) {
    if(report.hasOwnProperty("warnings") && report.warnings.length > 0) {
      return <span className="mdl-list__item-sub-title">{report.warnings.length} warnings</span>
    } else {
      return <span className="mdl-list__item-sub-title">no issues</span>
    }
  }

  renderTaskIcon(report) {
    if(report.hasOwnProperty("warnings") && report.warnings.length > 0) {
      return <Icon name="warning" className="silk-report-list-item-icon-red" />
    } else {
      return <Icon name="done" className="silk-report-list-item-icon-green" />
    }
  }

  renderReport(nodeId) {
    if(this.state.executionReport.taskReports.hasOwnProperty(this.state.selectedNode)) {
      return <ExecutionReport baseUrl={this.props.baseUrl}
                              project={this.props.project}
                              nodeId={nodeId}
                              executionReport={this.state.executionReport.taskReports[this.state.selectedNode]}/>
    } else {
      return  <div className="silk-report-card mdl-card mdl-shadow--2dp mdl-card--stretch">
                <div className="mdl-card__supporting-text">
                  Select a task for detailed results.
                </div>
              </div>
    }
  }
}

WorkflowExecutionReport.propTypes = {
  baseUrl: PropTypes.string.isRequired, // Base URL of the DI service
  project: PropTypes.string.isRequired, // project ID
  task: PropTypes.string.isRequired, // task ID
  time: PropTypes.string.isRequired, // timestamp of the current report
  diStore: PropTypes.shape({
    retrieveExecutionReport: PropTypes.func,
  }) // DI store object that provides the business layer API to DI related services
};

WorkflowExecutionReport.defaultProps = {
  diStore: silkStore
};
