'use client';

import React from 'react';
import { SimulationProvider } from '@/lib/simulation/simulation-context';
import { SimulatorHeader } from '@/components/simulator/SimulatorHeader';
import { ScenarioControlBar } from '@/components/simulator/ScenarioControlBar';
import { NodeSimulationPanel } from '@/components/simulator/NodeSimulationPanel';
import { MainArchitectureGraph } from '@/components/simulator/MainArchitectureGraph';
import { RoutingAndStatePanel } from '@/components/simulator/RoutingAndStatePanel';
import { QueueAndReservationPanel } from '@/components/simulator/QueueAndReservationPanel';
import { BlockchainStatePanel } from '@/components/simulator/BlockchainStatePanel';
import { SelfHealingPanel } from '@/components/simulator/SelfHealingPanel';
import { EventTimeline } from '@/components/simulator/EventTimeline';
import { ProfessorNotesPanel } from '@/components/simulator/ProfessorNotesPanel';
import { TransactionDetailModal } from '@/components/simulator/TransactionDetailModal';

export default function ArchitectureSimulatorPage() {
  return (
    <SimulationProvider>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        {/* Top Header & System Status */}
        <SimulatorHeader />

        {/* 6 Demo Scenarios + Chaos Matrix */}
        <ScenarioControlBar />

        {/* Core Animated Architecture Graph */}
        <MainArchitectureGraph />

        {/* Node Simulation & Consensus Engine */}
        <NodeSimulationPanel />

        {/* Transaction Creation & Routing Engine Decision */}
        <RoutingAndStatePanel />

        {/* Temporary Queue (Array + Linked List) & Live Balance Reservation */}
        <QueueAndReservationPanel />

        {/* Simulated Blockchain Explorer State */}
        <BlockchainStatePanel />

        {/* Self-Healing 8-Stage Pipeline */}
        <SelfHealingPanel />

        {/* Event Timeline & Live Metrics */}
        <EventTimeline />

        {/* Academic Notes for Professor & Novelty */}
        <ProfessorNotesPanel />

        {/* Transaction Lifecycle Modal / Drawer */}
        <TransactionDetailModal />
      </div>
    </SimulationProvider>
  );
}
