import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { parseKeyValueString, expandNodeList, parseTRES, detectAndParseAll, formatMemoryMB, ANONYMIZED_EXAMPLE_DATA } from '../parsing'
import type { SlurmData, SlurmQueueItem, SlurmHistoryItem } from '../types'


describe('Slurm Dashboard', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
  })

  const loadExampleData = async () => {
    await user.click(screen.getByRole('button', { name: 'Load example' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Overview/ })).toBeInTheDocument()
    })
  }

  describe('Data Parsing Functions', () => {
    let parsedData: SlurmData

    beforeEach(() => {
      parsedData = detectAndParseAll(ANONYMIZED_EXAMPLE_DATA)
    })

    it('should parse partitions correctly', () => {
      expect(parsedData.partitions.size).toBe(2)

      const gpuHigh = parsedData.partitions.get('gpu-high')
      expect(gpuHigh).toBeDefined()
      expect(gpuHigh?.details.PartitionName).toBe('gpu-high')
      expect(gpuHigh?.details.Default).toBe('NO')
      expect(gpuHigh?.details.State).toBe('UP')
      expect(gpuHigh?.details.TotalCPUs).toBe('128')
      expect(gpuHigh?.details.TotalNodes).toBe('3')

      const cpuLow = parsedData.partitions.get('cpu-low')
      expect(cpuLow).toBeDefined()
      expect(cpuLow?.details.PartitionName).toBe('cpu-low')
      expect(cpuLow?.details.Default).toBe('YES')
      expect(cpuLow?.details.State).toBe('UP')
      expect(cpuLow?.details.TotalCPUs).toBe('64')
      expect(cpuLow?.details.TotalNodes).toBe('2')
    })

    it('should expand node lists correctly', () => {
      const gpuHigh = parsedData.partitions.get('gpu-high')
      const nodesList = Array.from(gpuHigh?.nodes ?? [])
      expect(nodesList).toContain('node-a1')
      expect(nodesList).toContain('node-b1')
      expect(nodesList).toContain('node-b2')
      expect(nodesList.length).toBe(3)

      const cpuLow = parsedData.partitions.get('cpu-low')
      const cpuNodesList = Array.from(cpuLow?.nodes ?? [])
      expect(cpuNodesList).toContain('node-c1')
      expect(cpuNodesList).toContain('node-c2')
      expect(cpuNodesList.length).toBe(2)
    })

    it('should parse nodes correctly', () => {
      expect(parsedData.nodes.size).toBe(5)

      const nodeA1 = parsedData.nodes.get('node-a1')
      expect(nodeA1?.details.NodeName).toBe('node-a1')
      expect(nodeA1?.details.State).toBe('MIXED')
      expect(nodeA1?.details.CPUTot).toBe('32')
      expect(nodeA1?.details.CPUAlloc).toBe('8')
      expect(nodeA1?.details.Gres).toBe('gpu:a100:4')

      const nodeC2 = parsedData.nodes.get('node-c2')
      expect(nodeC2?.details.NodeName).toBe('node-c2')
      expect(nodeC2?.details.State).toBe('IDLE')
      expect(nodeC2?.details.CPUTot).toBe('32')
      expect(nodeC2?.details.CPUAlloc).toBe('0')
    })

    it('should parse queue jobs correctly', () => {
      expect(parsedData.queue.length).toBe(6)

      const runningJobs = parsedData.queue.filter(job => job.State === 'RUNNING')
      expect(runningJobs.length).toBe(5)

      const pendingJobs = parsedData.queue.filter(job => job.State === 'PENDING')
      expect(pendingJobs.length).toBe(1)

      const trainModelJob = parsedData.queue.find(job => job.JobId === '1336199')
      expect(trainModelJob?.Name).toBe('train_model')
      expect(trainModelJob?.User).toBe('user1')
      expect(trainModelJob?.Partition).toBe('gpu-high')
      expect(trainModelJob?.NodeList).toBe('node-a1')
    })

    it('should parse history correctly', () => {
      expect(parsedData.history.length).toBe(4)

      const completedJobs = parsedData.history.filter(job => job.State === 'COMPLETED')
      expect(completedJobs.length).toBe(1) // Fixed: only one main job, one is a step

      const failedJobs = parsedData.history.filter(job => job.State === 'FAILED')
      expect(failedJobs.length).toBe(1)

      const groundingJob = parsedData.history.find(job => job.JobID === '1336135')
      expect(groundingJob?.JobName).toBe('grounding')
      expect(groundingJob?.User).toBe('user1')
      expect(groundingJob?.State).toBe('COMPLETED')
      expect(groundingJob?.steps?.length).toBe(1)
    })

    it('should parse timestamp and timezone correctly', () => {
      expect(parsedData.clusterDate).toBe('2025-07-04T21:22:47-07:00')
      expect(parsedData.detectedTimezone).toBe('-07:00')
    })
  })

  describe('Utility Functions', () => {
    it('should parse key-value strings correctly', () => {
      const testString = 'PartitionName=gpu-high State=UP TotalCPUs=128'
      const result = parseKeyValueString(testString)

      expect(result.PartitionName).toBe('gpu-high')
      expect(result.State).toBe('UP')
      expect(result.TotalCPUs).toBe('128')
    })

    it('should expand node ranges correctly', () => {
      expect(expandNodeList('node-a1')).toEqual(['node-a1'])
      expect(expandNodeList('node-b[1-2]')).toEqual(['node-b1', 'node-b2'])
      expect(expandNodeList('node-c[1-2],node-d[10-11]')).toEqual(['node-c1', 'node-c2', 'node-d10', 'node-d11'])
      expect(expandNodeList('(null)')).toEqual([])
      expect(expandNodeList('')).toEqual([])
    })

    it('should parse TRES strings correctly', () => {
      const tresString = 'cpu=32,mem=256000M,billing=32,gres/gpu=4,gres/gpu:a100=4'
      const result = parseTRES(tresString)

      expect(result.cpu).toBe('32')
      expect(result.mem).toBe('256000M')
      expect(result.gres.gpu).toBe('4')
      expect(result.gres['gpu:a100']).toBe('4')
    })
  })

  describe('Initial Render', () => {
    it('should render the title and input panel', () => {
      render(<App />)

      expect(screen.getByText('Slurm Dashboard')).toBeInTheDocument()
      expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', expect.stringContaining('Paste one or more command outputs'))
      expect(screen.getByRole('button', { name: 'Analyze' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Load example' })).toBeInTheDocument()
    })

    it('should copy the command and show feedback', async () => {
      render(<App />)

      await user.click(screen.getByRole('button', { name: 'Copy' }))

      await waitFor(() => {
        expect(screen.getByText(/Copied!|Failed!/)).toBeInTheDocument()
      })
    })
  })

  describe('Overview Tab', () => {
    it('shows three tabs after analyzing, with Overview active', async () => {
      render(<App />)
      await loadExampleData()

      expect(screen.getByRole('button', { name: /^Overview/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^Queue/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^History/ })).toBeInTheDocument()
      // Old tabs are gone
      expect(screen.queryByRole('button', { name: 'Partitions' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Node Details' })).not.toBeInTheDocument()
    })

    it('collapses the input panel after analyzing and reopens via New data', async () => {
      render(<App />)
      await loadExampleData()

      expect(screen.queryByRole('button', { name: 'Analyze' })).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'New data' }))
      expect(screen.getByRole('button', { name: 'Analyze' })).toBeInTheDocument()
    })

    it('shows per-partition capacity cards with free resources', async () => {
      render(<App />)
      await loadExampleData()

      // gpu-high: a1 MIXED 2/4 free=2, b1 ALLOCATED free=0, b2 IDLE free=4 => 6 free of 12
      const gpuCard = screen.getByRole('region', { name: 'gpu-high capacity' })
      expect(within(gpuCard).getByText('6')).toBeInTheDocument()
      expect(within(gpuCard).getByText(/GPUs free/)).toBeInTheDocument()
      expect(within(gpuCard).getByText(/of 12/)).toBeInTheDocument()
      expect(within(gpuCard).getByText(/up to 4 on one node/)).toBeInTheDocument()
      expect(within(gpuCard).getByText(/1 idle/)).toBeInTheDocument()

      // cpu-low has no GPUs: headline is CPUs free (c1 ALLOCATED 0 free, c2 IDLE 32 free)
      const cpuCard = screen.getByRole('region', { name: 'cpu-low capacity' })
      expect(within(cpuCard).getByText('32')).toBeInTheDocument()
      expect(within(cpuCard).getByText(/CPUs free/)).toBeInTheDocument()
    })

    it('shows pending pressure on the affected partition card', async () => {
      render(<App />)
      await loadExampleData()

      // Job 1336162 PENDING on cpu-low requesting cpu=16
      const cpuCard = screen.getByRole('region', { name: 'cpu-low capacity' })
      expect(within(cpuCard).getByText(/1 job waiting/)).toBeInTheDocument()
      expect(within(cpuCard).getByText(/16 CPUs requested/)).toBeInTheDocument()
    })

    it('expands a capacity card to show partition config', async () => {
      render(<App />)
      await loadExampleData()

      const cpuCard = screen.getByRole('region', { name: 'cpu-low capacity' })
      await user.click(within(cpuCard).getByRole('button', { name: /config/i }))

      expect(within(cpuCard).getByText('Default')).toBeInTheDocument()
      expect(within(cpuCard).getByText('1-00:00:00')).toBeInTheDocument() // MaxTime
    })

    it('renders the node heatmap with trimmed labels grouped by partition', async () => {
      render(<App />)
      await loadExampleData()

      const heatmap = screen.getByRole('region', { name: 'Nodes' })
      // common prefix "node-" stripped
      expect(within(heatmap).getByText('a1')).toBeInTheDocument()
      expect(within(heatmap).getByText('b1')).toBeInTheDocument()
      expect(within(heatmap).getByText('c2')).toBeInTheDocument()
    })

    it('shows node details with running jobs when a heatmap cell is clicked', async () => {
      render(<App />)
      await loadExampleData()

      const heatmap = screen.getByRole('region', { name: 'Nodes' })
      await user.click(within(heatmap).getByRole('button', { name: /node-a1/ }))

      const detail = screen.getByRole('region', { name: 'node-a1 details' })
      expect(within(detail).getByText('MIXED')).toBeInTheDocument()
      expect(within(detail).getByText('1336199')).toBeInTheDocument() // running job on a1
      expect(within(detail).getAllByText(/GRES\/GPU/).length).toBeGreaterThan(0)
      // Job memory (AllocTRES mem=64G) is human-formatted
      expect(within(detail).getByText(/mem 64\.0 GiB/)).toBeInTheDocument()

      // Clicking again deselects
      await user.click(within(heatmap).getByRole('button', { name: /node-a1/ }))
      expect(screen.queryByRole('region', { name: 'node-a1 details' })).not.toBeInTheDocument()
    })

    it('shows usage by user sorted by GPUs', async () => {
      render(<App />)
      await loadExampleData()

      const usage = screen.getByRole('region', { name: 'Usage by user' })
      const rows = within(usage).getAllByTestId('user-row')
      // user1: 2 GPUs/24 CPUs, admin: 2 GPUs/16 CPUs, user2: 1 GPU/48 CPUs
      expect(rows[0]).toHaveTextContent('user1')
      expect(rows[1]).toHaveTextContent('admin')
      expect(rows[2]).toHaveTextContent('user2')
    })

    it('expands a user row to list their jobs', async () => {
      render(<App />)
      await loadExampleData()

      const usage = screen.getByRole('region', { name: 'Usage by user' })
      await user.click(within(usage).getByText('admin'))

      expect(within(usage).getByText('interactive')).toBeInTheDocument()
      expect(within(usage).getByText('1336183')).toBeInTheDocument()
    })
  })

  describe('Top Bar', () => {
    it('shows the snapshot timestamp after analyzing', async () => {
      render(<App />)
      await loadExampleData()

      expect(screen.getByText('2025-07-04T21:22:47-07:00')).toBeInTheDocument()
    })

    it('keeps relative times rendered when timezone setting changes', async () => {
      render(<App />)
      await loadExampleData()

      await user.click(screen.getByRole('button', { name: /^Queue/ }))
      await waitFor(() => {
        expect(screen.getAllByText(/ago|in \d/).length).toBeGreaterThan(0)
      })

      await user.selectOptions(screen.getByLabelText('Timezone'), 'utc')

      await waitFor(() => {
        expect(screen.getAllByText(/ago|in \d/).length).toBeGreaterThan(0)
      })
    })
  })

  describe('Queue Tab', () => {
    const openQueue = async () => {
      await loadExampleData()
      await user.click(screen.getByRole('button', { name: /^Queue/ }))
    }

    it('shows jobs with state chips and counts', async () => {
      render(<App />)
      await openQueue()

      expect(screen.getByRole('button', { name: /Running 5/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Pending 1/ })).toBeInTheDocument()

      expect(screen.getByText('1336199')).toBeInTheDocument()
      expect(screen.getByText('train_model')).toBeInTheDocument()
      expect(screen.getAllByText('user1').length).toBeGreaterThan(0)
    })

    it('lists pending jobs first with their reason', async () => {
      render(<App />)
      await openQueue()

      const rows = screen.getAllByTestId('job-row')
      expect(rows[0]).toHaveTextContent('1336162')
      expect(rows[0]).toHaveTextContent('Resources')
    })

    it('filters jobs by state chip', async () => {
      render(<App />)
      await openQueue()

      await user.click(screen.getByRole('button', { name: /Pending 1/ }))
      expect(screen.queryByText('1336199')).not.toBeInTheDocument()
      expect(screen.getByText('1336162')).toBeInTheDocument()

      // Click again to clear the filter
      await user.click(screen.getByRole('button', { name: /Pending 1/ }))
      expect(screen.getByText('1336199')).toBeInTheDocument()
    })

    it('filters jobs by text', async () => {
      render(<App />)
      await openQueue()

      await user.type(screen.getByPlaceholderText(/Filter/), 'train_model')

      expect(screen.getByText('1336199')).toBeInTheDocument()
      expect(screen.queryByText('1336189')).not.toBeInTheDocument()
    })

    it('shows job resources from TRES data', async () => {
      render(<App />)
      await openQueue()

      // 1336199: AllocTRES=cpu=8,mem=64G,node=1,billing=8,gres/gpu=1
      const row = screen.getAllByTestId('job-row').find(r => r.textContent?.includes('1336199'))
      expect(row).toHaveTextContent('1 GPU')
    })

    it('expands a job row to show resource details', async () => {
      render(<App />)
      await openQueue()

      await user.click(screen.getByText('1336199'))

      await waitFor(() => {
        expect(screen.getByText(/Allocated & Requested Resources|Allocated Resources/)).toBeInTheDocument()
        expect(screen.getByText(/Memory:/)).toBeInTheDocument()
      })
    })

    it('displays absolute and relative start times', async () => {
      render(<App />)
      await openQueue()

      expect(screen.getAllByText('2025-07-04T10:10:30').length).toBeGreaterThan(0)
      expect(screen.getAllByText(/ago|in \d/).length).toBeGreaterThan(0)
    })

    it('prefers untruncated partition and name from scontrol details', async () => {
      // squeue truncates columns (%.9P, %.30j); scontrol job lines carry full values
      const paste = [
        '             JOBID PARTITION                           NAME     USER    STATE       TIME TIME_LIMIT  NODES NODELIST(REASON)',
        '            165874 b200_inf_                          bash   vineet  RUNNING      12:38  UNLIMITED      1 n1',
        '---',
        'JobId=165874 JobName=bash UserId=vineet(10013) JobState=RUNNING Partition=b200_inf_ib StartTime=2026-06-06T00:54:39 NodeList=n1 AllocTRES=cpu=32,mem=170G,node=1,gres/gpu=1',
      ].join('\n')

      render(<App />)
      const textarea = screen.getByRole('textbox')
      await user.click(textarea)
      await user.paste(paste)
      await user.click(screen.getByRole('button', { name: 'Analyze' }))

      await waitFor(() => {
        expect(screen.getByText('b200_inf_ib')).toBeInTheDocument()
      })
    })
  })

  describe('History Tab', () => {
    const openHistory = async () => {
      await loadExampleData()
      await user.click(screen.getByRole('button', { name: /^History/ }))
    }

    it('shows state summary chips with counts', async () => {
      render(<App />)
      await openHistory()

      expect(screen.getByRole('button', { name: /COMPLETED 1/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /FAILED 1/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /CANCELLED 1/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /OUT_OF_MEMORY 1/ })).toBeInTheDocument()
    })

    it('filters by state chip', async () => {
      render(<App />)
      await openHistory()

      await user.click(screen.getByRole('button', { name: /FAILED 1/ }))

      expect(screen.getByText('1336136')).toBeInTheDocument()
      expect(screen.queryByText('1336135')).not.toBeInTheDocument()
    })

    it('filters by text', async () => {
      render(<App />)
      await openHistory()

      await user.type(screen.getByPlaceholderText(/Filter/), 'grounding')

      await waitFor(() => {
        expect(screen.getAllByText('grounding').length).toBeGreaterThan(0)
        expect(screen.queryByText('robo')).not.toBeInTheDocument()
      })
    })

    it('shows job steps when expanding a job with steps', async () => {
      render(<App />)
      await openHistory()

      await user.click(screen.getByText('1336135'))

      await waitFor(() => {
        expect(screen.getByText('Job Steps:')).toBeInTheDocument()
        expect(screen.getByText('1336135.batch')).toBeInTheDocument()
      })
    })

    it('displays absolute and relative times', async () => {
      render(<App />)
      await openHistory()

      expect(screen.getAllByText('2025-07-04T15:29:40').length).toBeGreaterThan(0)
      expect(screen.getAllByText(/ago|in \d/).length).toBeGreaterThan(0)
    })
  })

  describe('Error Handling', () => {
    it('should show an error for empty input', async () => {
      render(<App />)

      await user.click(screen.getByRole('button', { name: 'Analyze' }))

      await waitFor(() => {
        expect(screen.getByText('Please paste some Slurm output first.')).toBeInTheDocument()
      })
    })

    it('should show an error when no Slurm data is recognized', async () => {
      render(<App />)

      await user.type(screen.getByRole('textbox'), 'invalid slurm data')
      await user.click(screen.getByRole('button', { name: 'Analyze' }))

      await waitFor(() => {
        expect(screen.getByText(/No Slurm data recognized/)).toBeInTheDocument()
      })
      expect(screen.getByText('Slurm Dashboard')).toBeInTheDocument()
    })
  })

  describe('Tab Navigation', () => {
    it('should maintain data when switching between tabs', async () => {
      render(<App />)
      await loadExampleData()

      await user.click(screen.getByRole('button', { name: /^Queue/ }))
      await waitFor(() => {
        expect(screen.getAllByText('train_model').length).toBeGreaterThan(0)
      })

      await user.click(screen.getByRole('button', { name: /^Overview/ }))
      await waitFor(() => {
        expect(screen.getByRole('region', { name: 'gpu-high capacity' })).toBeInTheDocument()
      })
    })
  })

  describe('Type Safety Verification', () => {
    it('should maintain proper types throughout parsing', () => {
      const parsedData = detectAndParseAll(ANONYMIZED_EXAMPLE_DATA)

      // Verify partition types
      expect(parsedData.partitions).toBeInstanceOf(Map)
      parsedData.partitions.forEach((partition, name) => {
        expect(typeof name).toBe('string')
        expect(partition.nodes).toBeInstanceOf(Set)
        expect(typeof partition.details).toBe('object')
      })

      // Verify node types
      expect(parsedData.nodes).toBeInstanceOf(Map)
      parsedData.nodes.forEach((node, name) => {
        expect(typeof name).toBe('string')
        expect(typeof node.details).toBe('object')
      })

      // Verify queue types
      expect(Array.isArray(parsedData.queue)).toBe(true)
      parsedData.queue.forEach((job: SlurmQueueItem) => {
        expect(typeof job.JobId).toBe('string')
        expect(typeof job.Partition).toBe('string')
        expect(typeof job.User).toBe('string')
        expect(typeof job.State).toBe('string')
      })

      // Verify history types
      expect(Array.isArray(parsedData.history)).toBe(true)
      parsedData.history.forEach((job: SlurmHistoryItem) => {
        expect(typeof job.JobID).toBe('string')
        expect(typeof job.JobName).toBe('string')
        expect(typeof job.User).toBe('string')
        expect(typeof job.State).toBe('string')
        if (job.steps) {
          expect(Array.isArray(job.steps)).toBe(true)
        }
      })
    })
  })

  describe('formatMemoryMB', () => {
    it('should format MiB values', () => {
      expect(formatMemoryMB(512)).toBe('512 MiB')
    })

    it('should format GiB values', () => {
      expect(formatMemoryMB(1024)).toBe('1.0 GiB')
      expect(formatMemoryMB(256000)).toBe('250.0 GiB')
    })

    it('should format TiB values', () => {
      expect(formatMemoryMB(1048576)).toBe('1.0 TiB')
    })
  })
})
