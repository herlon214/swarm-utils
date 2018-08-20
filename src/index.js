// Libs
const Docker = require('dockerode')
const { map } = require('awaity/fp')
const { table } = require('table')
const debug = require('debug')('swarm-utils')

// Initializtion
const docker = new Docker({ socketPath: '/var/run/docker.sock' })
let summaryTable = [
  ['Nodes', 'Tasks', 'Tasks/Node', 'Nodes exceeding tasks limit'],
  ['-', '-', '-', '-']
]

// Return an array with nodes tasks
const buildNodeTasksTable = (nodes) => {
  nodesTasksTable = [[], []]
  nodes.forEach(node => {
    nodesTasksTable[0].push(`${node.Description.Hostname} - (${node.Spec.Role})`)
    if (node.Tasks.length > 0) {
      nodesTasksTable[1].push(node.Tasks.join('\n'))
    } else {
      nodesTasksTable[1].push('None')
    }
  })
  return nodesTasksTable
}

async function main () {
  // Get nodes
  let nodes = await docker.listNodes()

  // Get running tasks
  let tasks = await docker.listTasks()
  tasks = tasks.filter(task => task.Status.State === 'running')

  // Insert tasks into his node
  nodes = await map(async node => {
    // List running node's tasks 
    node['Tasks'] = tasks.filter(task => task.NodeID === node.ID)
  
    return node
  }, nodes)

  // Count how many tasks must be in each node
  const tasksAvg = Math.round(tasks.length / nodes.length)

  // Get the nodes that are exceeding task average
  const nodesExceeding = nodes.filter(node => node['Tasks'].length > tasksAvg)

  // Update summary table
  summaryTable[1][0] = nodes.length
  summaryTable[1][1] = tasks.length
  summaryTable[1][2] = tasksAvg
  summaryTable[1][3] = nodesExceeding.length

  debug(`Summary:`)
  console.log(table(summaryTable))

  // Show the node's tasks table
  debug(`Nodes with tasks:`)
  console.log(table(buildNodeTasksTable(nodes)))

  // Show exceeding tasks information
  nodesExceeding.forEach(node => {
    const tasksNumber = node['Tasks'].length
    debug(`Node ${node.Description.Hostname} have ${tasksNumber} tasks, ${tasksNumber - tasksAvg} more than the limit.`)
  })
}

main()