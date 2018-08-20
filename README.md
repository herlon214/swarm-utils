# Swarm Utils

Provide some utilities and automations for working with services in docker swarm.

## Tasks Balancing

1. Count how many nodes are connected to the swarm cluster.
2. Count how many tasks are running in the nodes.
3. Get an average of how many tasks must run in each node (`tasksNumber / nodesNumber`)
4. Check each node, if it has more tasks than should have kill the exceeding ones. The Docker Swarm will use the Round Robin algorithm to insert the killed task to the next node.