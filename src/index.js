// Libs
const Docker = require('dockerode')
const { map } = require('awaity/fp')

// Initializtion
const docker = new Docker({ socketPath: '/var/run/docker.sock' })

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


  console.log(nodes)
}

main()