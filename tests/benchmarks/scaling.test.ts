import { beforeEach, describe, expect, it } from 'vitest';
import { PerformanceTimer } from '../utils/test-helpers';

/**
 * Scaling and Load Benchmark Tests
 * Focus on performance characteristics under different load and scale conditions
 */
describe('Scaling and Load Benchmarks', () => {
    let timer: PerformanceTimer;

    beforeEach(() => {
        timer = new PerformanceTimer();
    });

    describe('Repository Size Scaling', () => {
        it('should scale linearly with repository size', async () => {
            // Use smaller dataset in CI to reduce runtime
            const isCI = process.env.CI === 'true' || process.env.TEST_ENV === 'ci';
            const repositorySizes = isCI 
                ? [1000, 5000, 10000] // Faster CI version
                : [1000, 5000, 10000, 25000, 50000]; // Full local version
                
            const scalingResults: Array<{ size: number; time: number; nodesPerMs: number }> = [];

            for (const repoSize of repositorySizes) {
                timer.start(`scaling_test_${repoSize}`);

                // Simulate processing repository of given size
                const processingResult = await processRepositoryOfSize(repoSize);

                const processingTime = timer.end(`scaling_test_${repoSize}`);
                const nodesPerMs = repoSize / processingTime;

                scalingResults.push({
                    size: repoSize,
                    time: processingTime,
                    nodesPerMs
                });

                console.log(`Repository size ${repoSize}: ${processingTime.toFixed(2)}ms (${nodesPerMs.toFixed(2)} nodes/ms)`);

                expect(processingResult.success).toBe(true);
                expect(processingResult.processedNodes).toBe(repoSize);
            }

            // Performance should scale reasonably
            const smallRepo = scalingResults[0]; // 1000 nodes
            const largeRepo = scalingResults[scalingResults.length - 1]; // largest repo

            // Adjust scaling expectations for CI
            const maxScalingFactor = isCI ? 15 : 70; // More lenient for CI
            const scalingFactor = largeRepo.time / smallRepo.time;
            const sizeRatio = largeRepo.size / smallRepo.size;

            console.log(`Scaling analysis:`);
            console.log(`  Size ratio: ${sizeRatio}x`);
            console.log(`  Time ratio: ${scalingFactor.toFixed(2)}x`);
            console.log(`  Scaling efficiency: ${((sizeRatio / scalingFactor) * 100).toFixed(1)}%`);

            expect(scalingFactor).toBeLessThan(maxScalingFactor); // Use CI-aware threshold

            // Throughput should remain reasonable for all sizes
            scalingResults.forEach(result => {
                expect(result.nodesPerMs).toBeGreaterThan(0.1); // At least 0.1 nodes per millisecond
            });
        });

        it('should handle extremely large repositories within time constraints', async () => {
            // Skip this expensive test in CI unless explicitly requested
            const isCI = process.env.CI === 'true' || process.env.TEST_ENV === 'ci';
            if (isCI && !process.env.RUN_EXPENSIVE_TESTS) {
                console.log('Skipping expensive test in CI environment');
                return;
            }

            const massiveRepoSize = isCI ? 50000 : 100000; // Smaller size for CI

            timer.start('massive_repo_test');

            // Process in chunks to manage memory
            const chunkSize = 10000;
            const chunks = Math.ceil(massiveRepoSize / chunkSize);
            let totalProcessed = 0;

            for (let chunk = 0; chunk < chunks; chunk++) {
                const currentChunkSize = Math.min(chunkSize, massiveRepoSize - totalProcessed);
                const chunkResult = await processRepositoryOfSize(currentChunkSize);

                totalProcessed += chunkResult.processedNodes;

                // Progress logging
                if ((chunk + 1) % 5 === 0) {
                    const progress = ((chunk + 1) / chunks * 100).toFixed(1);
                    console.log(`  Massive repo progress: ${progress}% (${totalProcessed}/${massiveRepoSize})`);
                }
            }

            const totalTime = timer.end('massive_repo_test');
            const targetTime = 10 * 60 * 1000; // 10 minutes as per acceptance criteria

            console.log(`Massive Repository Test:`);
            console.log(`  Total nodes: ${totalProcessed}`);
            console.log(`  Total time: ${(totalTime / 1000).toFixed(2)}s`);
            console.log(`  Target time: ${(targetTime / 1000).toFixed(0)}s`);
            console.log(`  Performance: ${((targetTime - totalTime) / 1000).toFixed(2)}s under target`);

            expect(totalProcessed).toBe(massiveRepoSize);
            expect(totalTime).toBeLessThan(targetTime);
        });
    });

    describe('Concurrent User Simulation', () => {
        it('should handle multiple concurrent users efficiently', async () => {
            const userCounts = [1, 5, 10, 25, 50];
            const queriesPerUser = 20;
            const concurrencyResults: Record<number, { totalTime: number; avgLatency: number; throughput: number }> = {};

            for (const userCount of userCounts) {
                timer.start(`concurrent_users_${userCount}`);

                // Create concurrent user sessions
                const userPromises = Array.from({ length: userCount }, (_, userId) =>
                    simulateUserSession(userId, queriesPerUser)
                );

                const userResults = await Promise.all(userPromises);
                const totalTime = timer.end(`concurrent_users_${userCount}`);

                const allLatencies = userResults.flatMap(result => result.queryLatencies);
                const avgLatency = allLatencies.reduce((sum, lat) => sum + lat, 0) / allLatencies.length;
                const totalQueries = userCount * queriesPerUser;
                const throughput = totalQueries / (totalTime / 1000);

                concurrencyResults[userCount] = { totalTime, avgLatency, throughput };

                console.log(`${userCount} concurrent users:`);
                console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
                console.log(`  Average latency: ${avgLatency.toFixed(2)}ms`);
                console.log(`  Throughput: ${throughput.toFixed(2)} queries/sec`);

                // Verify all users completed successfully
                expect(userResults.every(result => result.success)).toBe(true);
            }

            // Performance should degrade gracefully with more users
            const singleUser = concurrencyResults[1];
            const manyUsers = concurrencyResults[50];

            // Average latency shouldn't increase more than 5x with 50x users
            expect(manyUsers.avgLatency).toBeLessThan(singleUser.avgLatency * 5);

            // Throughput should increase with more users (up to a point)
            expect(concurrencyResults[10].throughput).toBeGreaterThan(singleUser.throughput * 5);
        });

        it('should maintain MCP and CLI performance under load', async () => {
            const concurrentMCPClients = 10;
            const concurrentCLIClients = 5;
            const queriesPerClient = 30;

            timer.start('mixed_client_load_test');

            // Start MCP clients
            const mcpPromises = Array.from({ length: concurrentMCPClients }, (_, id) =>
                simulateMCPClientSession(id, queriesPerClient)
            );

            // Start CLI clients (more resource intensive)
            const cliPromises = Array.from({ length: concurrentCLIClients }, (_, id) =>
                simulateCLIClientSession(id, queriesPerClient)
            );

            // Run both types concurrently
            const [mcpResults, cliResults] = await Promise.all([
                Promise.all(mcpPromises),
                Promise.all(cliPromises)
            ]);

            const totalTime = timer.end('mixed_client_load_test');

            // Analyze MCP performance
            const mcpLatencies = mcpResults.flatMap(result => result.queryLatencies);
            const avgMCPLatency = mcpLatencies.reduce((sum, lat) => sum + lat, 0) / mcpLatencies.length;
            const maxMCPLatency = Math.max(...mcpLatencies);

            // Analyze CLI performance
            const cliLatencies = cliResults.flatMap(result => result.queryLatencies);
            const avgCLILatency = cliLatencies.reduce((sum, lat) => sum + lat, 0) / cliLatencies.length;
            const maxCLILatency = Math.max(...cliLatencies);

            console.log(`Mixed Client Load Test (${totalTime.toFixed(2)}ms):`);
            console.log(`  MCP - Avg: ${avgMCPLatency.toFixed(2)}ms, Max: ${maxMCPLatency.toFixed(2)}ms`);
            console.log(`  CLI - Avg: ${avgCLILatency.toFixed(2)}ms, Max: ${maxCLILatency.toFixed(2)}ms`);

            // Performance requirements under load
            expect(avgMCPLatency).toBeLessThan(250); // Slightly higher than standalone (200ms)
            expect(maxMCPLatency).toBeLessThan(1600); // Allow for occasional spikes under heavy load
            expect(avgCLILatency).toBeLessThan(600); // Slightly higher than standalone (500ms)
            expect(maxCLILatency).toBeLessThan(2000); // Allow for CLI overhead under load

            // All clients should succeed
            expect(mcpResults.every(result => result.success)).toBe(true);
            expect(cliResults.every(result => result.success)).toBe(true);
        });
    });

    describe('Memory Pressure Scenarios', () => {
        it('should maintain performance under memory pressure', async () => {
            const memoryPressureScenarios = [
                { name: 'normal', pressure: 0 },
                { name: 'moderate', pressure: 100 * 1024 * 1024 }, // 100MB
                { name: 'high', pressure: 250 * 1024 * 1024 },     // 250MB
                { name: 'extreme', pressure: 500 * 1024 * 1024 }   // 500MB
            ];

            for (const scenario of memoryPressureScenarios) {
                timer.start(`memory_pressure_${scenario.name}`);

                // Create memory pressure
                const memoryPressure: Buffer[] = [];
                if (scenario.pressure > 0) {
                    const bufferCount = Math.floor(scenario.pressure / (10 * 1024 * 1024)); // 10MB buffers
                    for (let i = 0; i < bufferCount; i++) {
                        memoryPressure.push(Buffer.alloc(10 * 1024 * 1024, 'x'));
                    }
                }

                const beforeMemory = process.memoryUsage();

                // Perform standard operations under pressure
                const operationResults = await Promise.all([
                    processRepositoryOfSize(5000),
                    simulateUserSession(1, 10),
                    simulateMCPClientSession(1, 15),
                    simulateCLIClientSession(1, 8)
                ]);

                const afterMemory = process.memoryUsage();
                const testTime = timer.end(`memory_pressure_${scenario.name}`);

                console.log(`Memory pressure scenario: ${scenario.name}`);
                console.log(`  Test time: ${testTime.toFixed(2)}ms`);
                console.log(`  Memory used: ${((afterMemory.heapUsed - beforeMemory.heapUsed) / 1024 / 1024).toFixed(2)}MB`);

                // Clean up memory pressure
                memoryPressure.length = 0;

                // All operations should succeed even under memory pressure
                expect(operationResults.every(result => result.success)).toBe(true);

                // Performance shouldn't degrade too much under memory pressure
                expect(testTime).toBeLessThan(60000); // 1 minute maximum
            }
        });

        it('should recover gracefully from memory spikes', async () => {
            const spikeCycles = 5;
            const baselineResults: number[] = [];
            const spikeResults: number[] = [];
            const recoveryResults: number[] = [];

            for (let cycle = 0; cycle < spikeCycles; cycle++) {
                // Baseline measurement
                timer.start(`baseline_${cycle}`);
                await processRepositoryOfSize(1000);
                const baselineTime = timer.end(`baseline_${cycle}`);
                baselineResults.push(baselineTime);

                // Memory spike
                const memorySpike = Buffer.alloc(200 * 1024 * 1024, 'spike'); // 200MB spike

                timer.start(`spike_${cycle}`);
                await processRepositoryOfSize(1000);
                const spikeTime = timer.end(`spike_${cycle}`);
                spikeResults.push(spikeTime);

                // Clear spike and measure recovery
                memorySpike.fill(0);

                timer.start(`recovery_${cycle}`);
                await processRepositoryOfSize(1000);
                const recoveryTime = timer.end(`recovery_${cycle}`);
                recoveryResults.push(recoveryTime);

                // Force cleanup
                if (global.gc) global.gc();
            }

            const avgBaseline = baselineResults.reduce((a, b) => a + b, 0) / baselineResults.length;
            const avgSpike = spikeResults.reduce((a, b) => a + b, 0) / spikeResults.length;
            const avgRecovery = recoveryResults.reduce((a, b) => a + b, 0) / recoveryResults.length;

            console.log('Memory Spike Recovery:');
            console.log(`  Baseline avg: ${avgBaseline.toFixed(2)}ms`);
            console.log(`  Spike avg: ${avgSpike.toFixed(2)}ms`);
            console.log(`  Recovery avg: ${avgRecovery.toFixed(2)}ms`);

            // Recovery should be close to baseline
            expect(avgRecovery).toBeLessThan(avgBaseline * 1.5);

            // Spikes shouldn't cause catastrophic performance loss
            expect(avgSpike).toBeLessThan(avgBaseline * 3);
        });
    });
});

// Helper functions for scaling and load testing
async function processRepositoryOfSize(nodeCount: number): Promise<{ success: boolean; processedNodes: number }> {
    // Simulate realistic repository processing time
    const baseProcessingTime = nodeCount * 0.05; // 0.05ms per node base time
    const varianceTime = Math.random() * nodeCount * 0.02; // Up to 0.02ms variance per node

    const totalProcessingTime = baseProcessingTime + varianceTime;

    // Add some CPU-bound work to make it realistic
    let computeWork = 0;
    for (let i = 0; i < Math.min(nodeCount / 100, 1000); i++) {
        computeWork += Math.sin(i) * Math.cos(i * 2);
    }

    await new Promise(resolve => setTimeout(resolve, totalProcessingTime));

    return {
        success: Math.random() > 0.001, // 99.9% success rate
        processedNodes: nodeCount
    };
}

interface UserSessionResult {
    success: boolean;
    queryLatencies: number[];
    userId: number;
}

async function simulateUserSession(userId: number, queryCount: number): Promise<UserSessionResult> {
    const queryLatencies: number[] = [];

    for (let i = 0; i < queryCount; i++) {
        const queryStart = Date.now();

        // Simulate different types of user queries
        const queryType = i % 4;
        let queryTime: number;

        switch (queryType) {
            case 0: // Simple search
                queryTime = 50 + Math.random() * 100;
                break;
            case 1: // Complex search
                queryTime = 100 + Math.random() * 200;
                break;
            case 2: // Code analysis
                queryTime = 150 + Math.random() * 250;
                break;
            case 3: // Repository scan
                queryTime = 200 + Math.random() * 300;
                break;
            default:
                queryTime = 100;
        }

        await new Promise(resolve => setTimeout(resolve, queryTime));

        const actualLatency = Date.now() - queryStart;
        queryLatencies.push(actualLatency);

        // Small delay between queries
        await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
    }

    return {
        success: queryLatencies.length === queryCount,
        queryLatencies,
        userId
    };
}

async function simulateMCPClientSession(clientId: number, queryCount: number): Promise<UserSessionResult> {
    const queryLatencies: number[] = [];

    for (let i = 0; i < queryCount; i++) {
        const queryStart = Date.now();

        // MCP queries are typically faster and more focused
        const mcpQueryTime = 30 + Math.random() * 120; // 30-150ms range

        await new Promise(resolve => setTimeout(resolve, mcpQueryTime));

        const actualLatency = Date.now() - queryStart;
        queryLatencies.push(actualLatency);

        // Shorter delay between MCP queries
        await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
    }

    return {
        success: queryLatencies.length === queryCount,
        queryLatencies,
        userId: clientId
    };
}

async function simulateCLIClientSession(clientId: number, queryCount: number): Promise<UserSessionResult> {
    const queryLatencies: number[] = [];

    for (let i = 0; i < queryCount; i++) {
        const queryStart = Date.now();

        // CLI queries are more comprehensive and slower
        const cliQueryTime = 100 + Math.random() * 300; // 100-400ms range

        await new Promise(resolve => setTimeout(resolve, cliQueryTime));

        const actualLatency = Date.now() - queryStart;
        queryLatencies.push(actualLatency);

        // Longer delay between CLI queries
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    }

    return {
        success: queryLatencies.length === queryCount,
        queryLatencies,
        userId: clientId
    };
}