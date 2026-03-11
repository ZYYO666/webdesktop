<template>
  <div class="h-full w-full flex flex-col bg-white text-slate-800 relative">
    <n-layout has-sider class="h-full w-full bg-transparent">
      <!-- Sidebar -->
      <n-layout-sider
        collapse-mode="transform"
        :collapsed="siderCollapsed"
        :collapsed-width="0"
        :width="220"
        :native-scrollbar="false"
        @update:collapsed="siderCollapsed = $event"
        class="bg-gray-50 h-full border-r border-gray-100"
      >
        <div class="h-full flex flex-col pb-4 overflow-y-auto select-none">
          <div class="shrink-0" style="height: var(--immersive-safe-top, 48px)" data-window-drag></div>
          
          <div class="mb-4">
            <div class="px-4 py-1.5 text-[12px] font-bold text-gray-400/80 uppercase tracking-wide">概览</div>
            <div class="px-2 space-y-1.5">
              <button 
                @click="selectTab('overview')"
                class="group w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all cursor-default relative"
                :class="activeTab === 'overview' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
              >
                <Cpu :size="15" stroke-width="2" class="transition-colors duration-200" :class="activeTab === 'overview' ? 'text-white' : 'text-blue-500'" />
                <span class="truncate relative z-10">性能概览</span>
              </button>
              <button 
                @click="selectTab('process')"
                class="group w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all cursor-default relative"
                :class="activeTab === 'process' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
              >
                <Activity :size="15" stroke-width="2" class="transition-colors duration-200" :class="activeTab === 'process' ? 'text-white' : 'text-emerald-500'" />
                <span class="truncate relative z-10">进程管理</span>
              </button>
            </div>
          </div>

          <div class="mb-4">
            <div class="px-4 py-1.5 text-[12px] font-bold text-gray-400/80 uppercase tracking-wide">监控</div>
            <div class="px-2 space-y-1.5">
              <button
                @click="selectTab('system-info')"
                class="group w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all cursor-default relative"
                :class="activeTab === 'system-info' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
              >
                <Server :size="15" stroke-width="2" class="transition-colors duration-200" :class="activeTab === 'system-info' ? 'text-white' : 'text-slate-500'" />
                <span class="truncate relative z-10">系统信息</span>
              </button>
              <button
                @click="selectTab('io')"
                class="group w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all cursor-default relative"
                :class="activeTab === 'io' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
              >
                <HardDrive :size="15" stroke-width="2" class="transition-colors duration-200" :class="activeTab === 'io' ? 'text-white' : 'text-slate-500'" />
                <span class="truncate relative z-10">I/O 指标</span>
              </button>
              <button
                @click="selectTab('network')"
                class="group w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all cursor-default relative"
                :class="activeTab === 'network' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
              >
                <Wifi :size="15" stroke-width="2" class="transition-colors duration-200" :class="activeTab === 'network' ? 'text-white' : 'text-slate-500'" />
                <span class="truncate relative z-10">网络连接</span>
              </button>
              <button
                @click="selectTab('users')"
                class="group w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all cursor-default relative"
                :class="activeTab === 'users' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
              >
                <Users :size="15" stroke-width="2" class="transition-colors duration-200" :class="activeTab === 'users' ? 'text-white' : 'text-slate-500'" />
                <span class="truncate relative z-10">在线用户</span>
              </button>
            </div>
          </div>
        </div>
      </n-layout-sider>

      <!-- Main Content -->
      <n-layout class="h-full bg-transparent flex flex-col min-w-0" :native-scrollbar="false">
        <!-- Header -->
        <div class="flex items-center justify-between bg-white/60 backdrop-blur-xl border-b border-gray-100 z-30 flex-shrink-0 h-12 px-3 pr-3 md:pr-32 absolute top-0 left-0 right-0" data-window-drag>
          <div class="flex items-center gap-4 min-w-0 flex-1">
            <button
              class="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors md:hidden"
              title="菜单"
              @click="toggleSider"
            >
              <X v-if="!siderCollapsed" :size="18" />
              <Menu v-else :size="18" />
            </button>
          </div>

          <div class="flex items-center gap-3 shrink-0">
            <button 
              @click="handleRefresh" 
              class="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors" 
              :class="{ 'animate-spin': loadingStats }"
              title="刷新"
            >
              <RefreshCw :size="16" />
            </button>
          </div>
        </div>

        <!-- Content Area -->
        <n-layout-content
          class="flex-1 min-h-0 pt-12"
          content-style="display: flex; flex-direction: column; position: relative;"
          :native-scrollbar="false"
        >
          <div class="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6">
            <div v-if="loadingStats && !stats.system.platform" class="h-full flex flex-col items-center justify-center">
              <n-spin size="large" />
              <p class="text-slate-400 font-medium mt-4">{{ '初始化中...' }}</p>
            </div>

            <div v-else class="max-w-7xl mx-auto pb-10">
            <!-- Process Tab -->
            <div v-show="activeTab === 'process'" class="space-y-6">
              <n-card class="rounded-2xl border-gray-100" :bordered="false" size="small">
                <n-space align="center" justify="space-between" class="flex-wrap gap-3">
                  <n-space align="center" class="flex-wrap gap-3">
                    <n-input v-model:value="processQuery" placeholder="搜索进程 / PID / 用户" clearable class="w-44 sm:w-64" size="small">
                      <template #prefix>
                        <n-icon size="14">
                          <Search />
                        </n-icon>
                      </template>
                    </n-input>
                    <n-select v-model:value="processSortBy" :options="processSortOptions" class="w-28 sm:w-36" size="small" />
                    <n-select v-model:value="processSortOrder" :options="processOrderOptions" class="w-24 sm:w-32" size="small" />
                  </n-space>
                  <n-space align="center" class="flex-wrap gap-2">
                    <n-tag size="small" type="info" :bordered="false">
                      {{ '总计 ' + processSummary.all }}
                    </n-tag>
                    <n-tag size="small" type="success" :bordered="false">
                      {{ '运行 ' + processSummary.running }}
                    </n-tag>
                    <n-tag size="small" type="warning" :bordered="false">
                      {{ '阻塞 ' + processSummary.blocked }}
                    </n-tag>
                    <n-tag size="small" type="default" :bordered="false">
                      {{ '休眠 ' + processSummary.sleeping }}
                    </n-tag>
                  </n-space>
                </n-space>
              </n-card>

              <n-card class="rounded-2xl border-gray-100 overflow-hidden" content-style="padding: 0;" :bordered="false">
                <n-data-table
                  :columns="processColumns"
                  :data="processList"
                  :loading="loadingProcesses"
                  :row-key="rowKey"
                  :row-props="rowProps"
                  :scroll-x="processTableScrollX"
                  size="small"
                  :bordered="false"
                />
              </n-card>

              <n-card v-if="selectedProcess" class="rounded-2xl border-gray-100" content-style="display: flex; flex-direction: column; gap: 16px;" :bordered="false">
                <div class="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <div class="text-lg font-semibold text-slate-800">
                      {{ selectedProcess.name || '未知进程' }}
                    </div>
                    <div class="text-xs text-slate-400">
                      {{ selectedProcess.command || selectedProcess.path || '-' }}
                    </div>
                  </div>
                  <n-space align="center">
                    <n-tag size="small" type="info" :bordered="false">{{ 'PID ' + selectedProcess.pid }}</n-tag>
                    <n-tag size="small" type="default" :bordered="false">{{ selectedProcess.user || '未知用户' }}</n-tag>
                  </n-space>
                </div>
                <n-grid :x-gap="16" :y-gap="16" :cols="processDetailGridCols">
                  <n-grid-item>
                    <n-card size="small" class="rounded-xl bg-slate-50" content-style="padding: 12px;" :bordered="false">
                      <n-descriptions :column="1" label-placement="left" size="small">
                        <n-descriptions-item :label="'CPU'">
                          {{ formatPercentValue(selectedProcess.cpu) }}%
                        </n-descriptions-item>
                        <n-descriptions-item :label="'内存'">
                          {{ formatPercentValue(selectedProcess.mem) }}% · {{ formatSize(selectedProcess.memRss) }}
                        </n-descriptions-item>
                        <n-descriptions-item :label="'线程'">
                          {{ selectedProcess.threads }}
                        </n-descriptions-item>
                        <n-descriptions-item :label="'状态'">
                          {{ selectedProcess.state || '-' }}
                        </n-descriptions-item>
                      </n-descriptions>
                    </n-card>
                  </n-grid-item>
                  <n-grid-item>
                    <n-card size="small" class="rounded-xl bg-slate-50" content-style="display: flex; flex-direction: column; gap: 8px;" :bordered="false">
                      <div class="text-sm font-medium text-slate-600">{{ '负载' }}</div>
                      <div class="min-h-[180px]">
                        <apexchart width="100%" height="180" type="line" :options="processChartOptions" :series="processSeries" />
                      </div>
                    </n-card>
                  </n-grid-item>
                </n-grid>
              </n-card>
            </div>

            <!-- Overview Tab -->
            <div v-show="activeTab === 'overview'" class="space-y-6">
              <n-grid :x-gap="24" :y-gap="24" :cols="performanceGridCols">
                <n-grid-item>
                  <n-card class="rounded-2xl h-full bg-white border border-gray-100" :bordered="false">
                    <div class="flex justify-between items-start mb-2">
                      <n-statistic :label="'CPU 负载'">
                        <template #prefix>
                          <span class="text-2xl font-semibold text-slate-800">{{ formatPercentValue(stats.system.cpu.load) }}</span>
                        </template>
                        <template #suffix>%</template>
                      </n-statistic>
                      <n-icon size="18" class="text-gray-400"><Cpu /></n-icon>
                    </div>
                    <n-progress
                      type="line"
                      :percentage="stats.system.cpu.load"
                      :color="stats.system.cpu.load > 80 ? '#ef4444' : '#3b82f6'"
                      :show-indicator="false"
                      processing
                    />
                    <p class="text-xs text-slate-400 mt-2 truncate">{{ stats.system.cpu.brand }}</p>
                  </n-card>
                </n-grid-item>

                <n-grid-item>
                  <n-card class="rounded-2xl h-full bg-white border border-gray-100" :bordered="false">
                    <div class="flex justify-between items-start mb-2">
                      <n-statistic :label="'内存'">
                        <template #prefix>
                          <span class="text-2xl font-semibold text-slate-800">{{ formatPercent(stats.system.memory.used, stats.system.memory.total) }}</span>
                        </template>
                        <template #suffix>%</template>
                      </n-statistic>
                      <n-icon size="18" class="text-gray-400"><Zap /></n-icon>
                    </div>
                    <n-progress
                      type="line"
                      :percentage="(stats.system.memory.used / stats.system.memory.total) * 100"
                      color="#6366f1"
                      :show-indicator="false"
                    />
                    <p class="text-xs text-slate-400 mt-2">{{ formatSize(stats.system.memory.used) }} / {{ formatSize(stats.system.memory.total) }}</p>
                  </n-card>
                </n-grid-item>

                <n-grid-item>
                  <n-card class="rounded-2xl h-full bg-white border border-gray-100" :bordered="false">
                    <div class="flex justify-between items-start mb-2">
                      <div>
                        <p class="text-sm font-semibold text-slate-500 mb-1">{{ '网络' }}</p>
                        <div class="flex items-baseline gap-1">
                          <span class="text-2xl font-semibold text-slate-800">↓{{ formatSpeed(stats.system.network.speed.rx_sec) }}</span>
                        </div>
                        <div class="flex items-baseline gap-1">
                          <span class="text-lg font-semibold text-slate-500">↑{{ formatSpeed(stats.system.network.speed.tx_sec) }}</span>
                        </div>
                      </div>
                      <n-icon size="18" class="text-gray-400"><Wifi /></n-icon>
                    </div>
                    <div class="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div class="h-full bg-gray-400" :style="{ width: networkPulseWidth }"></div>
                    </div>
                  </n-card>
                </n-grid-item>

                <n-grid-item>
                  <n-card class="rounded-2xl h-full bg-white border border-gray-100" :bordered="false">
                    <div class="flex justify-between items-start mb-2">
                      <n-statistic :label="'运行时间'">
                        <template #default>
                          <span class="text-2xl font-semibold text-slate-800">{{ formatUptime(stats.system.uptime) }}</span>
                        </template>
                      </n-statistic>
                      <n-icon size="18" class="text-gray-400"><Server /></n-icon>
                    </div>
                    <p class="text-xs text-slate-400 mt-4 flex items-center gap-1">
                      {{ stats.system.platform }} {{ stats.system.arch }}
                    </p>
                  </n-card>
                </n-grid-item>
              </n-grid>

              <n-grid :x-gap="24" :y-gap="24" :cols="trendGridCols">
                <n-grid-item>
                  <n-card class="rounded-2xl h-full bg-white border border-gray-100" content-style="display: flex; flex-direction: column; height: 100%;" :bordered="false">
                    <template #header>
                      <div class="flex items-center gap-2 text-[14px] font-semibold text-slate-800">
                        <n-icon size="18" class="text-gray-400"><Activity /></n-icon>
                        {{ 'CPU / 内存趋势' }}
                      </div>
                    </template>
                    <div class="flex-1 w-full min-h-[260px]">
                      <apexchart width="100%" height="260" type="area" :options="systemChartOptions" :series="systemSeries" />
                    </div>
                  </n-card>
                </n-grid-item>

                <n-grid-item>
                  <n-card class="rounded-2xl h-full bg-white border border-gray-100" :bordered="false">
                    <template #header>
                      <div class="flex items-center gap-2 text-[14px] font-semibold text-slate-800">
                        <n-icon size="18" class="text-gray-400"><HardDrive /></n-icon>
                        {{ '存储' }}
                      </div>
                    </template>
                    <div class="space-y-6">
                      <div v-for="(disk, idx) in stats.system.storage.disks" :key="idx" class="group">
                        <div class="flex justify-between items-center mb-2">
                          <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400">
                              <n-icon size="20"><HardDrive /></n-icon>
                            </div>
                            <div>
                              <p class="font-semibold text-slate-700 text-sm">{{ disk.name || disk.device || disk.mount }}</p>
                              <p class="text-xs text-slate-400">{{ disk.type }} • {{ disk.vendor }}</p>
                            </div>
                          </div>
                          <div class="text-right">
                            <p class="font-bold text-slate-700 text-sm">{{ formatSize(disk.used || 0) }} / {{ formatSize(disk.size || 0) }}</p>
                            <p class="text-xs text-slate-400">{{ (disk.use || 0).toFixed(1) }}% {{ '已用' }}</p>
                          </div>
                        </div>
                        <n-progress
                          type="line"
                          :percentage="disk.use || 0"
                          :color="(disk.use || 0) > 90 ? '#ef4444' : ((disk.use || 0) > 70 ? '#f59e0b' : '#3b82f6')"
                          :show-indicator="false"
                        />
                      </div>
                    </div>
                  </n-card>
                </n-grid-item>
              </n-grid>
            </div>

            <!-- System Info Tab -->
            <div v-show="activeTab === 'system-info'" class="space-y-6">
              <n-card class="rounded-2xl h-full bg-white border border-gray-100" :bordered="false">
                <template #header>
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2 text-[14px] font-semibold text-slate-800">
                      <n-icon size="18" class="text-gray-400"><Server /></n-icon>
                      {{ '系统信息' }}
                    </div>
                    <n-button size="small" tertiary @click="fetchSystemInfo" :loading="loadingSystemInfo">刷新</n-button>
                  </div>
                </template>

                <n-descriptions size="small" :column="2" label-placement="left" class="mb-2">
                  <n-descriptions-item label="主机名">{{ stats.system.hostname || '-' }}</n-descriptions-item>
                  <n-descriptions-item label="系统">{{ [stats.system.distro, stats.system.release].filter(Boolean).join(' ') || '-' }}</n-descriptions-item>
                  <n-descriptions-item label="平台">{{ stats.system.platform || '-' }}</n-descriptions-item>
                  <n-descriptions-item label="架构">{{ stats.system.arch || '-' }}</n-descriptions-item>
                  <n-descriptions-item label="运行时间">{{ formatUptime(stats.system.uptime || 0) }}</n-descriptions-item>
                  <n-descriptions-item label="最后刷新">{{ lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '--:--:--' }}</n-descriptions-item>
                </n-descriptions>

                <div class="h-px bg-gray-100 my-4"></div>

                <n-descriptions size="small" :column="1" label-placement="left">
                  <n-descriptions-item label="设备">
                    {{ systemInfo?.system?.manufacturer ? `${systemInfo.system.manufacturer} ${systemInfo.system.model || ''}`.trim() : '-' }}
                  </n-descriptions-item>
                  <n-descriptions-item label="UUID">
                    {{ systemInfo?.system?.uuid || '-' }}
                  </n-descriptions-item>
                  <n-descriptions-item label="CPU">
                    {{ systemInfo?.cpu?.brand || '-' }}
                  </n-descriptions-item>
                  <n-descriptions-item label="内存条">
                    {{ Array.isArray(systemInfo?.memory?.layout) ? systemInfo.memory.layout.length : 0 }}
                  </n-descriptions-item>
                  <n-descriptions-item label="显卡">
                    {{
                      systemInfo?.graphics?.controllers?.length
                        ? systemInfo.graphics.controllers.map(c => c.model).filter(Boolean).join(' / ')
                        : '-'
                    }}
                  </n-descriptions-item>
                </n-descriptions>
              </n-card>
            </div>

            <!-- IO Tab -->
            <div v-show="activeTab === 'io'" class="space-y-6">
              <n-card class="rounded-2xl h-full bg-white border border-gray-100" :bordered="false">
                <template #header>
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2 text-[14px] font-semibold text-slate-800">
                      <n-icon size="18" class="text-gray-400"><HardDrive /></n-icon>
                      {{ 'I/O 指标' }}
                    </div>
                    <n-button size="small" tertiary @click="fetchIoStats" :loading="loadingIo">刷新</n-button>
                  </div>
                </template>

                <div class="grid grid-cols-2 gap-4">
                  <div class="rounded-xl bg-slate-50 p-3 border border-gray-100">
                    <div class="text-xs text-slate-500 mb-1">{{ '文件系统吞吐' }}</div>
                    <div class="text-sm font-semibold text-slate-800">{{ formatSpeed(fsStats?.rx_sec || 0) }} / {{ formatSpeed(fsStats?.wx_sec || 0) }}</div>
                    <div class="text-[11px] text-slate-400 mt-1">{{ '读 / 写' }}</div>
                  </div>
                  <div class="rounded-xl bg-slate-50 p-3 border border-gray-100">
                    <div class="text-xs text-slate-500 mb-1">{{ '磁盘 IOPS' }}</div>
                    <div class="text-sm font-semibold text-slate-800">{{ formatNumber(storageIo?.rIO_sec) }} / {{ formatNumber(storageIo?.wIO_sec) }}</div>
                    <div class="text-[11px] text-slate-400 mt-1">{{ '读 / 写' }}</div>
                  </div>
                  <div class="rounded-xl bg-slate-50 p-3 border border-gray-100">
                    <div class="text-xs text-slate-500 mb-1">{{ '磁盘总 IOPS' }}</div>
                    <div class="text-sm font-semibold text-slate-800">{{ formatNumber(storageIo?.tIO_sec) }}</div>
                    <div class="text-[11px] text-slate-400 mt-1">{{ '每秒' }}</div>
                  </div>
                  <div class="rounded-xl bg-slate-50 p-3 border border-gray-100">
                    <div class="text-xs text-slate-500 mb-1">{{ '采样延迟' }}</div>
                    <div class="text-sm font-semibold text-slate-800">{{ formatNumber(fsStats?.ms) }} ms</div>
                    <div class="text-[11px] text-slate-400 mt-1">{{ 'fsStats' }}</div>
                  </div>
                </div>
              </n-card>
            </div>

            <!-- Network Tab -->
            <div v-show="activeTab === 'network'" class="space-y-6">
              <n-card class="rounded-2xl border-gray-100 overflow-hidden" content-style="padding: 0;" :bordered="false">
                <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                  <div class="font-semibold text-slate-800 text-[14px]">{{ '网络连接' }}</div>
                  <n-space align="center" class="gap-2">
                    <n-select v-model:value="connectionsState" :options="connectionsStateOptions" class="w-28" size="small" />
                    <n-select v-model:value="connectionsLimit" :options="connectionsLimitOptions" class="w-28" size="small" />
                    <n-button size="small" tertiary @click="fetchConnections" :loading="loadingConnections">刷新</n-button>
                  </n-space>
                </div>
                <n-data-table
                  :columns="connectionsColumns"
                  :data="connections.list"
                  :loading="loadingConnections"
                  size="small"
                  :bordered="false"
                  :scroll-x="900"
                />
              </n-card>
            </div>

            <!-- Users Tab -->
            <div v-show="activeTab === 'users'" class="space-y-6">
              <n-card class="rounded-2xl border-gray-100 overflow-hidden" content-style="padding: 0;" :bordered="false">
                <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                  <div class="font-semibold text-slate-800 text-[14px]">{{ '在线用户' }}</div>
                  <n-button size="small" tertiary @click="fetchSystemMetrics" :loading="loadingMetrics">刷新</n-button>
                </div>
                <n-data-table
                  :columns="usersColumns"
                  :data="systemMetrics?.users || []"
                  :loading="loadingMetrics"
                  size="small"
                  :bordered="false"
                  :scroll-x="720"
                />
              </n-card>
            </div>
            </div>
          </div>
        </n-layout-content>
      </n-layout>
    </n-layout>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch, h } from 'vue';
import {
  Activity, Cpu, Zap, Wifi, HardDrive, RefreshCw, Search, Server, Users, Menu, X
} from 'lucide-vue-next';
import {
  NLayout, NLayoutContent, NLayoutSider,
  NCard, NGrid, NGridItem, NStatistic, NIcon, NProgress, NSpin, NButton,
  NTag, NDescriptions, NDescriptionsItem, NInput, NSelect, NSpace, NDataTable
} from 'naive-ui';
import VueApexCharts from 'vue3-apexcharts';
import { useOs } from '@/os';

const apexchart = VueApexCharts;

const os = useOs();
const api = os.api;
const { toast, dialog } = os.ui;

const activeTab = ref('process');
const windowWidth = computed(() => {
  const w = os.window?.data?.width;
  return typeof w === 'number' ? w : window.innerWidth;
});
const isSmallScreen = computed(() => windowWidth.value < 768);
const siderCollapsed = ref(false);

watch(
  isSmallScreen,
  (small) => {
    siderCollapsed.value = small;
  },
  { immediate: true }
);

const toggleSider = () => {
  siderCollapsed.value = !siderCollapsed.value;
};

const closeSider = () => {
  if (isSmallScreen.value) siderCollapsed.value = true;
};

const selectTab = (tab) => {
  if (activeTab.value === tab) {
    closeSider();
    return;
  }
  activeTab.value = tab;
  closeSider();
  if (tab === 'overview') return;
  if (tab === 'process') {
    if (!processList.value.length) fetchProcesses();
    if (selectedPid.value) fetchProcessDetail();
    return;
  }
  if (tab === 'system-info') {
    if (!systemInfo.value) fetchSystemInfo();
    return;
  }
  if (tab === 'io') {
    if (!storageIo.value || !fsStats.value) fetchIoStats();
    return;
  }
  if (tab === 'network') {
    fetchConnections();
    return;
  }
  if (tab === 'users') {
    fetchSystemMetrics();
  }
};

const processTableScrollX = computed(() => (windowWidth.value < 640 ? 900 : 1200));
const processDetailGridCols = computed(() => (windowWidth.value < 900 ? 1 : 2));
const performanceGridCols = computed(() => {
  const w = windowWidth.value;
  if (w < 640) return 1;
  if (w < 1024) return 2;
  if (w < 1280) return 3;
  return 4;
});
const trendGridCols = computed(() => (windowWidth.value < 1024 ? 1 : 2));
const loadingStats = ref(true);
const loadingProcesses = ref(true);
const loadingSystemInfo = ref(false);
const loadingMetrics = ref(false);
const loadingConnections = ref(false);
const loadingIo = ref(false);
const lastUpdated = ref(null);
const timer = ref(null);

const stats = ref({
  usersCount: 0,
  mountsCount: 0,
  system: {
    platform: '',
    distro: '',
    release: '',
    hostname: '',
    arch: '',
    uptime: 0,
    cpu: { load: 0, brand: '', cores: 0, physicalCores: 0 },
    memory: { total: 0, free: 0, used: 0 },
    storage: { disks: [], mounts: [] },
    network: { speed: { rx_sec: 0, tx_sec: 0 }, interfaces: [] }
  }
});

const processList = ref([]);
const processSummary = ref({ all: 0, running: 0, blocked: 0, sleeping: 0 });
const processQuery = ref('');
const processSortBy = ref('cpu');
const processSortOrder = ref('desc');
const selectedPid = ref(null);
const processDetail = ref(null);
const systemInfo = ref(null);
const systemMetrics = ref(null);
const storageIo = ref(null);
const fsStats = ref(null);
const connections = ref({ list: [], limit: 0, state: null });
const connectionsState = ref('');
const connectionsLimit = ref(500);

const processSortOptions = [
  { label: 'CPU', value: 'cpu' },
  { label: '内存', value: 'mem' },
  { label: '名称', value: 'name' },
  { label: 'PID', value: 'pid' }
];
const processOrderOptions = [
  { label: '降序', value: 'desc' },
  { label: '升序', value: 'asc' }
];

const connectionsStateOptions = [
  { label: '全部', value: '' },
  { label: 'LISTEN', value: 'listen' },
  { label: 'ESTABLISHED', value: 'established' },
  { label: 'TIME_WAIT', value: 'time_wait' },
  { label: 'CLOSE_WAIT', value: 'close_wait' }
];
const connectionsLimitOptions = [
  { label: '200', value: 200 },
  { label: '500', value: 500 },
  { label: '1000', value: 1000 }
];

const formatSize = (bytes) => {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatNumber = (n, digits = 0) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return '-';
  if (digits > 0) return v.toFixed(digits);
  return String(Math.round(v));
};

const formatSpeed = (bytesPerSec) => {
  return formatSize(bytesPerSec) + '/s';
};

const formatPercent = (val, total) => {
  if (!total) return 0;
  return ((val / total) * 100).toFixed(1);
};

const formatPercentValue = (val) => {
  if (!Number.isFinite(Number(val))) return '0.0';
  return Number(val).toFixed(1);
};

const formatUptime = (seconds) => {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  return `${h}h ${m}m`;
};

const systemCpuHistory = ref(Array(20).fill(0));
const systemMemHistory = ref(Array(20).fill(0));
const processCpuHistory = ref([]);
const processMemHistory = ref([]);

const systemSeries = computed(() => [
  { name: 'CPU', data: systemCpuHistory.value },
  { name: '内存', data: systemMemHistory.value }
]);

const systemChartOptions = {
  chart: {
    type: 'area',
    toolbar: { show: false },
    animations: { enabled: true, easing: 'linear', dynamicAnimation: { speed: 1000 } }
  },
  stroke: { curve: 'smooth', width: 2 },
  fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.6, opacityTo: 0.1, stops: [0, 90, 100] } },
  colors: ['#334155', '#94a3b8'],
  dataLabels: { enabled: false },
  xaxis: { labels: { show: false }, axisBorder: { show: false }, axisTicks: { show: false } },
  yaxis: { min: 0, max: 100, labels: { style: { colors: '#94a3b8' } } },
  grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
  tooltip: { x: { show: false } }
};

const processSeries = computed(() => [
  { name: 'CPU', data: processCpuHistory.value },
  { name: '内存', data: processMemHistory.value }
]);

const processChartOptions = {
  chart: {
    type: 'line',
    toolbar: { show: false },
    animations: { enabled: true, easing: 'linear', dynamicAnimation: { speed: 700 } }
  },
  stroke: { curve: 'smooth', width: 2 },
  colors: ['#334155', '#94a3b8'],
  dataLabels: { enabled: false },
  xaxis: { labels: { show: false }, axisBorder: { show: false }, axisTicks: { show: false } },
  yaxis: { min: 0, max: 100, labels: { style: { colors: '#94a3b8' } } },
  grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
  tooltip: { x: { show: false } }
};

const selectedProcess = computed(() => processDetail.value?.process || null);

const networkPulseWidth = computed(() => {
  const total = Number(stats.value.system.network.speed.rx_sec || 0) + Number(stats.value.system.network.speed.tx_sec || 0);
  const percent = Math.min(100, Math.max(8, Math.round(total / (1024 * 1024) * 10)));
  return `${percent}%`;
});

const handleRefresh = async () => {
  await fetchStats();
  if (activeTab.value === 'process') {
    await fetchProcesses();
    await fetchProcessDetail();
    return;
  }
  if (activeTab.value === 'overview') return;
  if (activeTab.value === 'system-info') {
    await fetchSystemInfo();
    return;
  }
  if (activeTab.value === 'io') {
    await fetchIoStats();
    return;
  }
  if (activeTab.value === 'network') {
    await fetchConnections();
    return;
  }
  if (activeTab.value === 'users') {
    await fetchSystemMetrics();
  }
};

const fetchStats = async () => {
  try {
    const data = await api.getTaskManagerStats();
    if (!data) return;
    stats.value = data;
    lastUpdated.value = new Date();
    const newLoad = data.system?.cpu?.load ?? 0;
    const memPercent = formatPercent(data.system?.memory?.used ?? 0, data.system?.memory?.total ?? 0);
    systemCpuHistory.value.push(newLoad);
    systemMemHistory.value.push(Number(memPercent));
    if (systemCpuHistory.value.length > 20) systemCpuHistory.value.shift();
    if (systemMemHistory.value.length > 20) systemMemHistory.value.shift();
  } catch (err) {
    toast.error(err?.message || '获取统计失败');
  } finally {
    loadingStats.value = false;
  }
};

const fetchSystemInfo = async () => {
  try {
    loadingSystemInfo.value = true;
    systemInfo.value = await api.getSystemInfo();
  } catch (err) {
    toast.error(err?.message || '获取系统信息失败');
  } finally {
    loadingSystemInfo.value = false;
  }
};

const fetchSystemMetrics = async () => {
  try {
    loadingMetrics.value = true;
    systemMetrics.value = await api.getSystemMetrics();
  } catch (err) {
    toast.error(err?.message || '获取系统指标失败');
  } finally {
    loadingMetrics.value = false;
  }
};

const fetchIoStats = async () => {
  try {
    loadingIo.value = true;
    const [io, fs] = await Promise.all([api.getStorageIo(), api.getFsStats()]);
    storageIo.value = io;
    fsStats.value = fs;
  } catch (err) {
    toast.error(err?.message || '获取 I/O 指标失败');
  } finally {
    loadingIo.value = false;
  }
};

const fetchConnections = async () => {
  try {
    loadingConnections.value = true;
    connections.value = await api.getNetworkConnections({
      state: connectionsState.value || undefined,
      limit: connectionsLimit.value
    });
  } catch (err) {
    toast.error(err?.message || '获取网络连接失败');
  } finally {
    loadingConnections.value = false;
  }
};

const fetchProcesses = async () => {
  try {
    loadingProcesses.value = true;
    const data = await api.getProcessList({
      q: processQuery.value || undefined,
      sortBy: processSortBy.value,
      order: processSortOrder.value,
      limit: 200
    });
    processList.value = Array.isArray(data?.list) ? data.list : [];
    processSummary.value = data?.summary || { all: 0, running: 0, blocked: 0, sleeping: 0 };
    if (!selectedPid.value && processList.value.length > 0) {
      selectedPid.value = processList.value[0].pid;
    }
  } catch (err) {
    toast.error(err?.message || '获取进程失败');
  } finally {
    loadingProcesses.value = false;
  }
};

const fetchProcessDetail = async () => {
  if (!selectedPid.value) return;
  try {
    const data = await api.getProcessDetail(selectedPid.value);
    processDetail.value = data;
    const load = data?.load;
    const cpu = Number(load?.cpu ?? data?.process?.cpu ?? 0);
    const mem = Number(load?.mem ?? data?.process?.mem ?? 0);
    processCpuHistory.value.push(cpu);
    processMemHistory.value.push(mem);
    if (processCpuHistory.value.length > 20) processCpuHistory.value.shift();
    if (processMemHistory.value.length > 20) processMemHistory.value.shift();
  } catch (err) {
    processDetail.value = null;
  }
};

const handleKill = async (pid) => {
  const confirmed = await dialog.confirm('确定要结束该进程吗？');
  if (!confirmed) return;
  try {
    await api.killProcess(pid, 'SIGTERM');
    toast.success('进程已结束');
    await fetchProcesses();
  } catch (err) {
    toast.error(err?.message || '结束进程失败');
  }
};

const rowKey = (row) => row.pid;
const rowProps = (row) => ({
  class: row.pid === selectedPid.value ? 'bg-gray-50' : '',
  onClick: () => {
    selectedPid.value = row.pid;
  }
});

const processColumns = computed(() => [
  {
    title: '进程',
    key: 'name',
    minWidth: 200,
    ellipsis: true
  },
  {
    title: 'PID',
    key: 'pid',
    width: 90
  },
  {
    title: '用户',
    key: 'user',
    minWidth: 120,
    ellipsis: true
  },
  {
    title: 'CPU',
    key: 'cpu',
    width: 100,
    render: (row) => `${formatPercentValue(row.cpu)}%`
  },
  {
    title: '内存',
    key: 'mem',
    width: 160,
    render: (row) => `${formatPercentValue(row.mem)}% · ${formatSize(row.memRss)}`
  },
  {
    title: '状态',
    key: 'state',
    width: 120,
    render: (row) => h(
      NTag,
      { size: 'small', bordered: false, type: row.state === 'running' ? 'success' : 'default' },
      { default: () => row.state || '-' }
    )
  },
  {
    title: '操作',
    key: 'actions',
    width: 120,
    render: (row) => h(
      NButton,
      {
        size: 'small',
        type: 'error',
        tertiary: true,
        onClick: (e) => {
          e.stopPropagation();
          handleKill(row.pid);
        }
      },
      { default: () => '结束' }
    )
  }
]);

const stateTagType = (state) => {
  const s = String(state || '').toLowerCase();
  if (s === 'established') return 'success';
  if (s === 'listen') return 'info';
  if (s.includes('wait')) return 'warning';
  if (s === 'close' || s.includes('close')) return 'error';
  return 'default';
};

const connectionsColumns = computed(() => [
  { title: '协议', key: 'protocol', width: 90 },
  {
    title: '本地',
    key: 'local',
    width: 210,
    render: (row) => `${row.localAddress || '-'}:${row.localPort || '-'}`
  },
  {
    title: '对端',
    key: 'peer',
    width: 210,
    render: (row) => `${row.peerAddress || '-'}:${row.peerPort || '-'}`
  },
  {
    title: '状态',
    key: 'state',
    width: 140,
    render: (row) => h(
      NTag,
      { size: 'small', bordered: false, type: stateTagType(row.state) },
      { default: () => row.state || '-' }
    )
  },
  { title: 'PID', key: 'pid', width: 90 },
  { title: '进程', key: 'process', minWidth: 220, ellipsis: { tooltip: true } }
]);

const usersColumns = computed(() => [
  { title: '用户', key: 'user', width: 140 },
  { title: 'TTY', key: 'tty', width: 140 },
  { title: 'IP', key: 'ip', width: 180 },
  { title: '时间', key: 'time', width: 180 },
  { title: '日期', key: 'date', width: 180 }
]);

watch([processQuery, processSortBy, processSortOrder], () => {
  if (activeTab.value !== 'process') return;
  fetchProcesses();
});

watch([connectionsState, connectionsLimit], () => {
  if (activeTab.value !== 'network') return;
  fetchConnections();
});

watch(selectedPid, () => {
  processCpuHistory.value = [];
  processMemHistory.value = [];
  if (activeTab.value !== 'process') return;
  fetchProcessDetail();
});

onMounted(() => {
  handleRefresh();
  let tick = 0;
  timer.value = setInterval(async () => {
    await fetchStats();
    tick += 1;
    if (activeTab.value === 'process') {
      await fetchProcesses();
      await fetchProcessDetail();
      return;
    }
    if (activeTab.value === 'io' && tick % 2 === 0) {
      await fetchIoStats();
      return;
    }
    if (activeTab.value === 'users' && tick % 2 === 0) {
      await fetchSystemMetrics();
      return;
    }
    if (activeTab.value === 'system-info' && tick % 10 === 0) {
      await fetchSystemInfo();
    }
  }, 3000);
});

onUnmounted(() => {
  if (timer.value) clearInterval(timer.value);
});
</script>
