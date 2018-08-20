// Libs
const Docker = require('dockerode')
const { map } = require('awaity/fp')
const debug = require('debug')('swarm-utils:main')

// Initializtion
const docker = new Docker({ socketPath: '/var/run/docker.sock' })

const divider = () => debug(`------------------------------------`)

async function main () {
  // Get nodes
  let nodes = await docker.listNodes()

  // Get tasks in each node
  const tasks = await docker.listTasks()

  // Parse tasks into each node
  nodes = await map(async node => {
    // List running node's tasks 
    node['Tasks'] = tasks.filter(task => task.NodeID === node.ID && task.Status.State === 'running')
  
    return node
  }, nodes)

  // Count how many tasks must be in each node
  const tasksAvg = Math.round(tasks.length / nodes.length)

  // Get the nodes that are exceeding task average
  const nodesExceeding = nodes.filter(node => node['Tasks'].length > tasksAvg)

  divider()
  debug(`Nodes connected: ${nodes.length}`)
  debug(`Tasks running: ${tasks.length}`)
  divider()
  debug(`Tasks per node: ${tasksAvg}`)
  debug(`Nodes exceeding: ${nodesExceeding.length}`)
}

main()