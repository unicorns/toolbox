import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App, { parseKeyValueString, expandNodeList, parseTRES, detectAndParseAll, ANONYMIZED_EXAMPLE_DATA } from '../App'
import type { SlurmData, SlurmQueueItem, SlurmHistoryItem } from '../types'


describe('Slurm Dashboard', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
  })

  const loadExampleData = async () => {
    const exampleButton = screen.getByText('Load Example Data')
    await user.click(exampleButton)
    
    const analyzeButton = screen.getByText('Analyze Cluster Data')
    await user.click(analyzeButton)
    
    // Wait for tabs to appear
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Partitions' })).toBeInTheDocument()
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

  describe('Component Rendering', () => {
    it('should render the main dashboard', () => {
      render(<App />)
      
      expect(screen.getByText('Slurm Dashboard')).toBeInTheDocument()
      expect(screen.getByText('An interactive dashboard for visualizing your Slurm cluster\'s status')).toBeInTheDocument()
      expect(screen.getByText('Recommended All-in-One Command')).toBeInTheDocument()
    })

    it('should show input area initially', () => {
      render(<App />)
      
      const textarea = screen.getByRole('textbox')
      expect(textarea).toBeInTheDocument()
      expect(textarea).toHaveAttribute('placeholder', expect.stringContaining('Paste one or more command outputs'))
      
      expect(screen.getByText('Analyze Cluster Data')).toBeInTheDocument()
      expect(screen.getByText('Load Example Data')).toBeInTheDocument()
    })

    it('should load example data when button is clicked', async () => {
      render(<App />)
      
      await loadExampleData()
      
      // Should show tabs after loading and analyzing data
      expect(screen.getByRole('button', { name: 'Partitions' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Node Details' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Job Queue' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'History' })).toBeInTheDocument()
    })

    it('should display partitions tab correctly', async () => {
      render(<App />)
      
      await loadExampleData()
      
      // Switch to partitions tab
      const partitionsTab = screen.getByRole('button', { name: 'Partitions' })
      await user.click(partitionsTab)
      
      await waitFor(() => {
        expect(screen.getAllByText('gpu-high')).toHaveLength(1)
        expect(screen.getAllByText('cpu-low')).toHaveLength(1)
        expect(screen.getByText('Default')).toBeInTheDocument() // cpu-low should show as default
      })
    })

    it('should switch to nodes tab and display nodes', async () => {
      render(<App />)
      
      await loadExampleData()
      
      const nodesTab = screen.getByRole('button', { name: 'Node Details' })
      await user.click(nodesTab)
      
      await waitFor(() => {
        expect(screen.getByText('node-a1')).toBeInTheDocument()
        expect(screen.getByText('node-b1')).toBeInTheDocument()
        expect(screen.getByText('node-b2')).toBeInTheDocument()
        expect(screen.getByText('node-c1')).toBeInTheDocument()
        expect(screen.getByText('node-c2')).toBeInTheDocument()
      })
    })

    it('should switch to queue tab and display jobs', async () => {
      render(<App />)
      
      await loadExampleData()
      
      const queueTab = screen.getByRole('button', { name: 'Job Queue' })
      await user.click(queueTab)
      
      await waitFor(() => {
        expect(screen.getByText('1336199')).toBeInTheDocument()
        expect(screen.getByText('train_model')).toBeInTheDocument()
        expect(screen.getAllByText('user1').length).toBeGreaterThan(0)
        expect(screen.getAllByText('RUNNING').length).toBeGreaterThan(0)
        expect(screen.getByText('PENDING')).toBeInTheDocument()
      })
    })

    it('should switch to history tab and display completed jobs', async () => {
      render(<App />)
      
      await loadExampleData()
      
      const historyTab = screen.getByRole('button', { name: 'History' })
      await user.click(historyTab)
      
      await waitFor(() => {
        expect(screen.getAllByText('grounding').length).toBeGreaterThan(0)
        expect(screen.getAllByText('COMPLETED').length).toBeGreaterThan(0)
        expect(screen.getByText('FAILED')).toBeInTheDocument()
        expect(screen.getByText('OUT_OF_MEMORY')).toBeInTheDocument()
      })
    })

    it('should allow filtering in history tab', async () => {
      render(<App />)
      
      await loadExampleData()
      
      const historyTab = screen.getByRole('button', { name: 'History' })
      await user.click(historyTab)
      
      await waitFor(() => {
        const filterInput = screen.getByPlaceholderText('Filter by Job ID, Name, or User...')
        expect(filterInput).toBeInTheDocument()
      })
      
      const filterInput = screen.getByPlaceholderText('Filter by Job ID, Name, or User...')
      await user.type(filterInput, 'grounding')
      
      await waitFor(() => {
        expect(screen.getAllByText('grounding').length).toBeGreaterThan(0)
        expect(screen.queryByText('robo')).not.toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle empty input gracefully', async () => {
      render(<App />)
      
      const analyzeButton = screen.getByText('Analyze Cluster Data')
      await user.click(analyzeButton)
      
      // Should show error message for empty input
      await waitFor(() => {
        expect(screen.getByText('Please paste some Slurm output first.')).toBeInTheDocument()
      })
    })

    it('should handle malformed data gracefully', async () => {
      render(<App />)
      
      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'invalid slurm data')
      
      const analyzeButton = screen.getByText('Analyze Cluster Data')
      await user.click(analyzeButton)
      
      // Should not crash and should show some default state
      expect(screen.getByText('Slurm Dashboard')).toBeInTheDocument()
    })
  })

  describe('Copy Functionality', () => {
    it('should handle copy command functionality', async () => {
      render(<App />)
      
      const copyButton = screen.getByText('Copy')
      expect(copyButton).toBeInTheDocument()
      
      // Click copy button
      await user.click(copyButton)
      
      // Should show feedback (either success or failure)
      await waitFor(() => {
        expect(screen.getByText(/Copied!|Failed!/)).toBeInTheDocument()
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

  describe('Time Display Tests', () => {
    it('should display both absolute and relative times in queue tab', async () => {
      render(<App />)
      
      await loadExampleData()
      
      const queueTab = screen.getByRole('button', { name: 'Job Queue' })
      await user.click(queueTab)
      
      await waitFor(() => {
        // Check for absolute time display (ISO format) - there may be multiple instances
        expect(screen.getAllByText('2025-07-04T10:10:30').length).toBeGreaterThan(0)
        expect(screen.getAllByText('2025-07-07T10:10:30').length).toBeGreaterThan(0)
        
        // Check for relative time display (should contain "ago" or "in")
        const relativeTimes = screen.getAllByText(/ago|in \d/)
        expect(relativeTimes.length).toBeGreaterThan(0)
      })
    })

    it('should display both absolute and relative times in history tab', async () => {
      render(<App />)
      
      await loadExampleData()
      
      const historyTab = screen.getByRole('button', { name: 'History' })
      await user.click(historyTab)
      
      await waitFor(() => {
        // Check for absolute time display (there may be multiple instances)
        expect(screen.getAllByText('2025-07-04T15:29:40').length).toBeGreaterThan(0)
        expect(screen.getAllByText('2025-07-04T21:07:32').length).toBeGreaterThan(0)
        
        // Check for relative time display
        const relativeTimes = screen.getAllByText(/ago|in \d/)
        expect(relativeTimes.length).toBeGreaterThan(0)
      })
    })

    it('should update relative times when timezone setting changes', async () => {
      render(<App />)
      
      await loadExampleData()
      
      const queueTab = screen.getByRole('button', { name: 'Job Queue' })
      await user.click(queueTab)
      
      // Get initial relative time text
      await waitFor(() => {
        const relativeTimes = screen.getAllByText(/ago|in \d/)
        expect(relativeTimes.length).toBeGreaterThan(0)
      })
      
      // Change timezone setting
      const timezoneSelector = screen.getByLabelText('Data Timestamp:')
      await user.selectOptions(timezoneSelector, 'utc')
      
      // Verify times are still displayed (they should recalculate)
      await waitFor(() => {
        const relativeTimes = screen.getAllByText(/ago|in \d/)
        expect(relativeTimes.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Job Details Expansion', () => {
    it('should expand job details when clicking on a job row in queue tab', async () => {
      render(<App />)
      
      await loadExampleData()
      
      const queueTab = screen.getByRole('button', { name: 'Job Queue' })
      await user.click(queueTab)
      
      await waitFor(() => {
        // Find a job row with an expansion arrow
        const expandArrows = screen.getAllByText('▶')
        expect(expandArrows.length).toBeGreaterThan(0)
      })
      
      // Click on the first expandable job row
      const expandArrows = screen.getAllByText('▶')
      const firstJobRow = expandArrows[0].closest('tr')
      expect(firstJobRow).toBeInTheDocument()
      
      await user.click(firstJobRow!)
      
      await waitFor(() => {
        // Check for rotated arrow (expanded state)
        const rotatedArrows = screen.getAllByText('▶').filter(arrow => 
          arrow.className.includes('rotate-90')
        )
        expect(rotatedArrows.length).toBeGreaterThan(0)
        
        // Check for resource details
        expect(screen.getByText(/Allocated Resources|Requested Resources/)).toBeInTheDocument()
      })
    })

    it('should expand job details when clicking on a job row in history tab', async () => {
      render(<App />)
      
      await loadExampleData()
      
      const historyTab = screen.getByRole('button', { name: 'History' })
      await user.click(historyTab)
      
      await waitFor(() => {
        // Find a job row with an expansion arrow
        const expandArrows = screen.getAllByText('▶')
        expect(expandArrows.length).toBeGreaterThan(0)
      })
      
      // Click on the first expandable job row
      const expandArrows = screen.getAllByText('▶')
      const firstJobRow = expandArrows[0].closest('tr')
      expect(firstJobRow).toBeInTheDocument()
      
      await user.click(firstJobRow!)
      
      await waitFor(() => {
        // Check for rotated arrow (expanded state)
        const rotatedArrows = screen.getAllByText('▶').filter(arrow => 
          arrow.className.includes('rotate-90')
        )
        expect(rotatedArrows.length).toBeGreaterThan(0)
        
        // Check for requested resources
        expect(screen.getByText('Requested Resources:')).toBeInTheDocument()
      })
    })

    it('should show job steps when expanding a job with steps in history tab', async () => {
      render(<App />)
      
      await loadExampleData()
      
      const historyTab = screen.getByRole('button', { name: 'History' })
      await user.click(historyTab)
      
      // Find and click on the job that has steps (job 1336135 has a .batch step)
      await waitFor(() => {
        const jobRows = screen.getAllByText('1336135')
        expect(jobRows.length).toBeGreaterThan(0)
      })
      
      const jobRow = screen.getAllByText('1336135')[0].closest('tr')
      expect(jobRow).toBeInTheDocument()
      
      await user.click(jobRow!)
      
      await waitFor(() => {
        // Check for job steps section
        expect(screen.getByText('Job Steps:')).toBeInTheDocument()
        expect(screen.getByText('1336135.batch')).toBeInTheDocument()
      })
    })
  })

  describe('Job State Display', () => {
    it('should display different colored states for jobs', async () => {
      render(<App />)
      
      await loadExampleData()
      
      const queueTab = screen.getByRole('button', { name: 'Job Queue' })
      await user.click(queueTab)
      
      await waitFor(() => {
        // Check for different job states with proper styling
        const runningJobs = screen.getAllByText('RUNNING')
        expect(runningJobs.length).toBeGreaterThan(0)
        runningJobs.forEach(job => {
          expect(job).toHaveClass('text-green-600')
        })
        
        const pendingJobs = screen.getAllByText('PENDING')
        expect(pendingJobs.length).toBeGreaterThan(0)
        pendingJobs.forEach(job => {
          expect(job).toHaveClass('text-yellow-600')
        })
      })
    })

    it('should display different colored states in history tab', async () => {
      render(<App />)
      
      await loadExampleData()
      
      const historyTab = screen.getByRole('button', { name: 'History' })
      await user.click(historyTab)
      
      await waitFor(() => {
        // Check for different job states with proper styling
        const completedJobs = screen.getAllByText('COMPLETED')
        expect(completedJobs.length).toBeGreaterThan(0)
        completedJobs.forEach(job => {
          expect(job).toHaveClass('text-blue-600')
        })
        
        const failedJobs = screen.getAllByText('FAILED')
        expect(failedJobs.length).toBeGreaterThan(0)
        failedJobs.forEach(job => {
          expect(job).toHaveClass('text-red-600')
        })
        
        const cancelledJobs = screen.getAllByText(/CANCELLED/).filter(element => 
          element.tagName === 'TD' && element.className.includes('text-red-600')
        )
        expect(cancelledJobs.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Resource Information Display', () => {
    it('should show CPU and memory information when job details are expanded', async () => {
      render(<App />)
      
      await loadExampleData()
      
      const queueTab = screen.getByRole('button', { name: 'Job Queue' })
      await user.click(queueTab)
      
      // Click on first expandable job
      await waitFor(() => {
        const expandArrows = screen.getAllByText('▶')
        expect(expandArrows.length).toBeGreaterThan(0)
      })
      
      const firstJobRow = screen.getAllByText('▶')[0].closest('tr')
      await user.click(firstJobRow!)
      
      await waitFor(() => {
        // Check for CPU information
        expect(screen.getByText(/CPU:/)).toBeInTheDocument()
        // Check for Memory information  
        expect(screen.getByText(/Memory:/)).toBeInTheDocument()
      })
    })

    it('should show GRES information when available', async () => {
      render(<App />)
      
      await loadExampleData()
      
      const queueTab = screen.getByRole('button', { name: 'Job Queue' })
      await user.click(queueTab)
      
      // Click on a job that has GPU allocation (train_model job should have GPU)
      await waitFor(() => {
        const trainModelJobs = screen.getAllByText('train_model')
        expect(trainModelJobs.length).toBeGreaterThan(0)
      })
      
      const trainModelJobRow = screen.getAllByText('train_model')[0].closest('tr')
      expect(trainModelJobRow).toBeInTheDocument()
      await user.click(trainModelJobRow!)
      
      await waitFor(() => {
        // Check for GRES/GPU information
        expect(screen.getAllByText(/GRES\/GPU/).length).toBeGreaterThan(0)
      })
    })
  })

  describe('Tab Navigation and Data Persistence', () => {
    it('should maintain data when switching between tabs', async () => {
      render(<App />)
      
      await loadExampleData()
      
      // Start on nodes tab, switch to queue, then back to nodes
      const nodesTab = screen.getByRole('button', { name: 'Node Details' })
      await user.click(nodesTab)
      
      await waitFor(() => {
        expect(screen.getByText('node-a1')).toBeInTheDocument()
      })
      
      const queueTab = screen.getByRole('button', { name: 'Job Queue' })
      await user.click(queueTab)
      
      await waitFor(() => {
        expect(screen.getAllByText('train_model').length).toBeGreaterThan(0)
      })
      
      // Switch back to nodes tab
      await user.click(nodesTab)
      
      await waitFor(() => {
        // Data should still be there
        expect(screen.getByText('node-a1')).toBeInTheDocument()
        expect(screen.getByText('node-b1')).toBeInTheDocument()
      })
    })

    it('should show appropriate message when no data is available for a tab', async () => {
      render(<App />)
      
      // Analyze empty data
      const analyzeButton = screen.getByText('Analyze Cluster Data')
      await user.click(analyzeButton)
      
      await waitFor(() => {
        expect(screen.getByText('Please paste some Slurm output first.')).toBeInTheDocument()
      })
    })
  })
})