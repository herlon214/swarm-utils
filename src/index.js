// Libs
const Docker = require('dockerode')
const { map } = require('awaity/fp')
const Table = require('cli-table')
const debug = require('debug')('swarm-utils')

// Initializtion
const docker = new Docker({ socketPath: '/var/run/docker.sock' })
let summaryTable = [
  ,
  ['-', '-', '-', '-']
]

const buildSummaryTable = (info) => {
  const table = new Table({
    head: ['Nodes', 'Tasks', 'Tasks/Node', 'Nodes exceeding tasks limit']
  })

  table.push([info.nodes, info.tasks, info.tasksAvg, info.tasksExceeding])

  return table
}

// Return an array with nodes tasks
const buildNodeTasksTable = (nodes) => {
  const table = new Table({
    head: nodes.map(node => `${node.Description.Hostname.substring(0, 20)} - (${node.Spec.Role})`)
  })

  // Insert data
  const data = []
  nodes.forEach(node => {
    if (node.Tasks.length > 0) {
      data.push(node.Tasks.map(task => task.Service.Spec.Name).join('\n'))
    } else {
      data.push('None')
    }
  })

  table.push(data)

  return table
}

/**
 * Return an array of nodes' id that aren't running the given task
 */
const nodesNotRunningService = (nodes, serviceId) => {
  let nodesAvailable = nodes.filter(node => {
    return node.Tasks.filter(task => task.Service.ID === serviceId).length === 0
  })
  return nodesAvailable.map(node => node.ID)
}

// Check anti-affinity in each node
const checkAntiAffinity = (nodes) => {
  nodes.forEach(node => {
    // Count the tasks with same service id
    const servicesCounter = node.Tasks.reduce((acc, item) => {
      if (!acc[item.Service.ID]) {
        acc[item.Service.ID] = 1
      } else {
        acc[item.Service.ID] += 1
      }

      return acc
    }, {})


    // Check for affinity
    Object.keys(servicesCounter).forEach(serviceId => {
      if (servicesCounter[serviceId] > 1) {
        debug(`Node ${node.Description.Hostname} has more than one service ${serviceId}`)

        // Get the node's tasks that match the serviceId
        const tasks = node.Tasks.filter(task => task.Service.ID === serviceId)

        // Check if there's another node that can receive the task
        const nodesAvailable = nodesNotRunningService(nodes, serviceId)

        // If there's another node that can receive the task we can kill in this node
        if (nodesAvailable.length > 0) {
          debug(`Must kill one of: ${tasks.map(task => task.ID).join(', ')}...`)
        } else {
          debug(`There is no other available nodes to receive this service...`)
        }

      }
    })
  })

}

async function main () {
  // Get nodes
  let nodes = await docker.listNodes()

  // Get services
  const services = await docker.listServices()

  // Get running tasks
  let tasks = await docker.listTasks()
  tasks = tasks.filter(task => task.Status.State === 'running')
  tasks = await map(async task => {
    task['Service'] = services.filter(service => service.ID === task.ServiceID)[0]
    return task
  }, tasks)

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
  console.log(buildSummaryTable({
    nodes: nodes.length,
    tasks: tasks.length,
    tasksAvg,
    tasksExceeding: nodesExceeding.length
  }).toString())

  // Show the node's tasks table
  debug(`Nodes with tasks:`)
  console.log(buildNodeTasksTable(nodes).toString())

  // Show exceeding tasks information
  nodesExceeding.forEach(node => {
    const tasksNumber = node['Tasks'].length
    debug(`Node ${node.Description.Hostname} have ${tasksNumber} tasks, ${tasksNumber - tasksAvg} more than the limit.`)
  })

  // Check for anti-affinity
  checkAntiAffinity(nodes)
}

main()