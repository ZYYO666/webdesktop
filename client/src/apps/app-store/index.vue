<template>
  <div class="app-store-shell w-full h-full bg-white flex flex-col overflow-hidden relative text-gray-900">
    <n-layout has-sider class="h-full w-full bg-transparent">
      <n-layout-sider
        collapse-mode="transform"
        :collapsed-width="0"
        :width="220"
        :native-scrollbar="false"
        class="bg-gray-50 h-full border-r border-gray-100"
      >
        <div class="h-full flex flex-col">
          <div class="shrink-0" style="height: var(--immersive-safe-top, 48px)" data-window-drag></div>
          <!-- Removed redundant header -->
          
          <div class="flex-1 px-2 space-y-1.5 overflow-y-auto select-none pt-2">
            <div
              v-for="t in tabItems"
              :key="t.key"
              class="group flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all cursor-default relative"
              :class="activeTab === t.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
              @click="activeTab = t.key"
            >
              <component
                :is="t.icon"
                :size="15"
                class="transition-colors duration-200"
                :class="activeTab === t.key ? 'text-white' : 'text-gray-500 group-hover:text-gray-600'"
                stroke-width="2"
              />
              <span class="truncate relative z-10">{{ t.label }}</span>
              <span
                v-if="t.badge"
                class="ml-auto text-[11px] font-medium truncate"
                :class="activeTab === t.key ? 'text-white/90' : 'text-gray-400 group-hover:text-gray-600'"
              >
                {{ t.badge }}
              </span>
            </div>
          </div>

          <div class="px-3 py-3 border-t border-gray-100">
            <div class="flex items-center gap-2 flex-wrap">
              <n-tag size="small" :bordered="false" :type="runtimeDockerOk ? 'success' : 'warning'">
                {{ runtimeLoaded ? (runtimeDockerOk ? 'Docker 可用' : 'Docker 不可用') : '检测中' }}
              </n-tag>
              <n-tag size="small" :bordered="false" type="info">
                {{ `${runningCount}/${totalCount} 运行` }}
              </n-tag>
            </div>
            <div v-if="runtimeLoaded && !runtimeDockerOk && runtimeDockerReason" class="text-[11px] text-amber-700 mt-2 truncate">
              {{ runtimeDockerReason }}
            </div>
          </div>
        </div>
      </n-layout-sider>

      <n-layout class="h-full bg-transparent flex flex-col min-w-0" :native-scrollbar="false">
        <div
          class="flex items-center justify-between bg-white/60 backdrop-blur-xl border-b border-gray-100 z-30 flex-shrink-0 h-12 px-3 pr-32 absolute top-0 left-0 right-0"
          data-window-drag
        >
          <div class="flex items-center gap-2 min-w-0">
            <div class="min-w-0 flex items-baseline gap-2">
              <h2 class="text-[14px] font-semibold text-gray-900 truncate">{{ activeTitle }}</h2>
              <span class="text-[12px] text-gray-400 truncate">{{ `${runningCount}/${totalCount} 运行` }}</span>
            </div>
          </div>

          <div class="flex items-center shrink-0 gap-2">
            <div
              class="flex items-center justify-end transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
              :class="searchOpen ? 'w-48' : 'w-8'"
            >
              <n-input
                v-if="searchOpen"
                :value="searchText"
                @update:value="searchText = $event"
                clearable
                :placeholder="'搜索...'"
                size="small"
                class="bg-gray-100/50 border-transparent hover:bg-gray-100 focus:bg-white text-[13px] !rounded-md w-48"
                @blur="handleSearchBlur"
              >
                <template #prefix>
                  <n-icon :size="14" class="text-gray-400"><Search /></n-icon>
                </template>
              </n-input>
              <n-button
                v-else
                quaternary
                circle
                size="small"
                class="text-gray-500 hover:text-gray-900"
                @click="toggleSearch"
              >
                <template #icon>
                  <Search :size="18" />
                </template>
              </n-button>
            </div>
            <n-dropdown trigger="click" :options="headerMenuOptions" @select="handleHeaderMenuSelect">
              <n-button quaternary circle size="small" :title="'选项'" class="text-gray-500 hover:text-gray-900">
                <template #icon><n-icon :size="18"><MoreHorizontal /></n-icon></template>
              </n-button>
            </n-dropdown>
          </div>
        </div>

        <n-layout-content
          class="bg-transparent flex-1 relative overflow-hidden pt-12"
          content-style="display: flex; flex-direction: column;"
          :native-scrollbar="false"
        >
          <div class="flex-1 min-h-0 overflow-y-auto px-6 py-6 md:px-8 md:py-8">
            <div v-if="loading" class="min-h-[60vh] flex flex-col items-center justify-center">
              <n-spin size="large" />
              <div class="text-slate-400 text-sm mt-4">{{ '加载中...' }}</div>
            </div>

            <n-result
              v-else-if="errorMsg"
              status="error"
              :title="errorMsg"
              :description="'请检查网络或服务状态'"
              class="max-w-xl mx-auto"
            >
              <template #footer>
                <n-button type="primary" @click="loadAll">{{ '重新加载' }}</n-button>
              </template>
            </n-result>

            <n-result
              v-else-if="runtimeLoaded && !runtimeDockerOk"
              status="warning"
              :title="'Docker 不可用'"
              :description="runtimeDockerReason || '请确认 Docker 已安装并运行'"
              class="max-w-xl mx-auto"
            >
              <template #footer>
                <n-button secondary @click="loadAll">{{ '重试' }}</n-button>
              </template>
            </n-result>

            <div v-else class="max-w-7xl mx-auto space-y-6 pb-10">
              <template v-if="activeTab === 'apps'">
            <n-card :bordered="false" size="small" content-style="display: flex; flex-direction: column; gap: 12px;">
              <template #header>
                <div class="flex items-center gap-2">
                  <n-icon size="18" class="text-slate-600">
                    <Package />
                  </n-icon>
                  <span class="font-semibold">{{ '安装任务' }}</span>
                </div>
              </template>
              <template #header-extra>
                <n-button size="small" secondary :loading="installJobsLoading" @click="refreshInstallJobs">
                  <template #icon>
                    <n-icon size="14">
                      <RefreshCw />
                    </n-icon>
                  </template>
                  {{ '刷新' }}
                </n-button>
              </template>

              <div v-if="installJobsLoading" class="py-6 flex items-center justify-center">
                <n-spin size="small" />
              </div>
              <n-empty v-else-if="installJobs.length === 0" :description="'暂无任务'" />
              <div v-else class="flex flex-col gap-3">
                <div
                  v-for="job in installJobs"
                  :key="job.id"
                  class="rounded-xl border border-slate-100 bg-white p-3 flex flex-col gap-2"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <div class="font-semibold text-sm truncate">
                          {{ templateNameMap.get(job.templateId) || job.templateId }}
                        </div>
                        <n-tag
                          size="small"
                          :bordered="false"
                          :type="normalizeStatus(job.status) === 'success'
                            ? 'success'
                            : normalizeStatus(job.status) === 'failed'
                              ? 'error'
                              : normalizeStatus(job.status) === 'canceled'
                                ? 'default'
                                : 'warning'"
                        >
                          {{ formatJobStatus(job.status) }}
                        </n-tag>
                        <span class="text-[11px] text-slate-400">{{ formatJobStep(job.step) }}</span>
                      </div>
                      <div class="text-xs text-slate-500 mt-1 truncate">
                        {{ formatTime(job.createdAt) }}
                        <template v-if="job.meta?.run?.name">
                          {{ ` • 容器：${job.meta.run.name}` }}
                        </template>
                      </div>
                    </div>
                    <div class="text-[11px] text-slate-400">{{ `${job.progress || 0}%` }}</div>
                  </div>

                  <n-progress :percentage="Math.max(0, Math.min(100, job.progress || 0))" :show-indicator="false" />

                  <div v-if="job.error" class="text-xs text-rose-600 wrap-break-word">{{ job.error }}</div>
                  <div
                    v-else-if="normalizeStatus(job.status) === 'success' && job.meta?.containerRunning === false"
                    class="text-xs text-amber-700 wrap-break-word"
                  >
                    {{ '容器已创建，但未运行（查看日志获取原因）' }}
                  </div>

                  <n-space align="center" class="flex-wrap gap-2 pt-1">
                    <n-button size="small" secondary :loading="jobLogsLoadingId === job.id" @click="openJobLogs(job)">
                      <template #icon>
                        <n-icon size="14">
                          <FileText />
                        </n-icon>
                      </template>
                      {{ '日志' }}
                    </n-button>
                    <n-button
                      v-if="normalizeStatus(job.status) === 'queued' || normalizeStatus(job.status) === 'running'"
                      size="small"
                      tertiary
                      type="error"
                      :loading="jobCancelLoadingId === job.id"
                      @click="cancelJob(job)"
                    >
                      {{ '取消' }}
                    </n-button>
                    <n-button
                      v-if="normalizeStatus(job.status) !== 'queued' && normalizeStatus(job.status) !== 'running'"
                      size="small"
                      tertiary
                      :loading="jobDeleteLoadingId === job.id"
                      @click="deleteJob(job)"
                    >
                      {{ '删除' }}
                    </n-button>
                    <n-button
                      v-if="normalizeStatus(job.status) === 'success' && job.meta?.run?.name"
                      size="small"
                      quaternary
                      @click="jumpToContainer(job.meta.run.name)"
                    >
                      {{ '查看容器' }}
                    </n-button>
                  </n-space>
                </div>
              </div>
            </n-card>

            <n-card :bordered="false" size="small" content-style="display: flex; flex-direction: column; gap: 14px;">
              <template #header>
                <div class="flex items-center gap-2">
                  <n-icon size="18" class="text-gray-600">
                    <Store />
                  </n-icon>
                  <span class="font-semibold">{{ '一键安装' }}</span>
                </div>
              </template>
              <template #header-extra>
                <n-button size="small" secondary :loading="templatesLoading" @click="loadTemplates">
                  <template #icon>
                    <n-icon size="14">
                      <RefreshCw />
                    </n-icon>
                  </template>
                  {{ '刷新' }}
                </n-button>
              </template>

              <div v-if="templatesLoading" class="py-8 flex items-center justify-center">
                <n-spin size="small" />
              </div>
              <n-empty v-else-if="filteredTemplates.length === 0" :description="'未找到应用'" />
              <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <n-card
                  v-for="tpl in filteredTemplates"
                  :key="tpl.id"
                  size="small"
                  :bordered="false"
                  class="hover:shadow-md transition-shadow"
                  content-style="display: flex; flex-direction: column; gap: 10px;"
                >
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 shrink-0">
                      <n-icon size="18">
                        <Package />
                      </n-icon>
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                          <div class="font-semibold text-sm text-gray-900 truncate">{{ tpl.name }}</div>
                          <div class="text-xs text-gray-500 mt-1 line-clamp-2">{{ tpl.description }}</div>
                        </div>
                        <div class="text-[10px] text-gray-400 truncate font-mono">{{ tpl.id }}</div>
                      </div>
                    </div>
                  </div>

                  <div class="flex flex-wrap gap-1">
                    <n-tag
                      v-for="tag in (Array.isArray(tpl.tags) ? tpl.tags : [])"
                      :key="tag"
                      size="small"
                      :bordered="false"
                      type="default"
                    >
                      {{ tag }}
                    </n-tag>
                  </div>

                  <div class="text-[11px] text-gray-500 flex flex-col gap-1">
                    <div class="truncate">{{ `镜像：${tpl.image || '-'}` }}</div>
                    <div v-if="tpl.ports?.length" class="truncate">{{ `端口：${tpl.ports.join(', ')}` }}</div>
                    <div v-if="tpl.defaultName" class="truncate">{{ `默认容器名：${tpl.defaultName}` }}</div>
                  </div>

                  <div class="flex items-center justify-end gap-2 pt-1">
                    <n-button
                      v-if="installedContainerNameByTemplateId.get(String(tpl.id))"
                      size="small"
                      secondary
                      @click="jumpToContainer(installedContainerNameByTemplateId.get(String(tpl.id)))"
                    >
                      {{ '查看容器' }}
                    </n-button>
                    <n-button
                      v-if="installedContainerNameByTemplateId.get(String(tpl.id))"
                      size="small"
                      tertiary
                      type="warning"
                      :disabled="installCreatingId === tpl.id || !runtimeDockerOk"
                      :loading="installCreatingId === tpl.id"
                      @click="reinstallTemplate(tpl)"
                    >
                      {{ '重新安装' }}
                    </n-button>
                    <n-button
                      v-else
                      size="small"
                      type="primary"
                      :disabled="installCreatingId === tpl.id || !runtimeDockerOk"
                      :loading="installCreatingId === tpl.id"
                      @click="installTemplate(tpl)"
                    >
                      {{ '一键安装' }}
                    </n-button>
                  </div>
                </n-card>
              </div>
            </n-card>
          </template>

          <template v-else-if="activeTab === 'containers'">
            <div v-if="filteredContainers.length === 0" class="py-10">
              <n-empty :description="'未找到容器'" />
            </div>
            <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <n-card
                v-for="c in filteredContainers"
                :key="c.id"
                size="small"
                :bordered="false"
                class="hover:shadow-md transition-shadow"
                content-style="display: flex; flex-direction: column; gap: 10px;"
              >
                <div class="flex items-start gap-3">
                  <div
                    class="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0"
                    :class="c.running ? (c.paused ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700') : 'bg-gray-50 border-gray-200 text-gray-500'"
                  >
                    <n-icon size="18">
                      <Terminal />
                    </n-icon>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <div class="flex items-center gap-2 min-w-0">
                          <div class="font-semibold text-sm text-gray-900 truncate">{{ c.name }}</div>
                          <span
                            class="h-2 w-2 rounded-full shrink-0"
                            :class="c.running ? (c.paused ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-gray-300'"
                          ></span>
                        </div>
                        <div class="text-xs text-gray-500 mt-1 line-clamp-2">{{ c.image }}</div>
                      </div>
                      <div class="text-[10px] text-gray-400 font-mono">{{ String(c.id || '').slice(0, 12) }}</div>
                    </div>
                  </div>
                </div>

                <div class="rounded-xl bg-gray-50 border border-gray-100 p-3 text-[11px] text-gray-600 space-y-1">
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-gray-400">{{ '状态' }}</span>
                    <span class="truncate">{{ c.status || '-' }}</span>
                  </div>
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-gray-400">{{ '端口' }}</span>
                    <span class="truncate">{{ c.ports || '-' }}</span>
                  </div>
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-gray-400">{{ '创建' }}</span>
                    <span class="truncate">{{ c.createdAt || '-' }}</span>
                  </div>
                </div>

                <div class="flex items-center justify-between gap-2 pt-1">
                  <div class="flex items-center gap-1.5">
                    <n-button size="small" secondary :loading="actionLoadingId === c.id" @click="toggleStartStop(c)">
                      <template #icon>
                        <n-icon size="14">
                          <component :is="c.running ? Square : Play" />
                        </n-icon>
                      </template>
                      {{ c.running ? '停止' : '启动' }}
                    </n-button>
                    <n-button circle quaternary size="small" :loading="actionLoadingId === c.id" title="重启" @click="doContainerAction(c, 'restart')">
                      <template #icon>
                        <n-icon size="16">
                          <RotateCcw />
                        </n-icon>
                      </template>
                    </n-button>
                    <n-button
                      v-if="c.running"
                      circle
                      quaternary
                      size="small"
                      :loading="actionLoadingId === c.id"
                      :title="c.paused ? '继续' : '暂停'"
                      @click="doContainerAction(c, c.paused ? 'unpause' : 'pause')"
                    >
                      <template #icon>
                        <n-icon size="16">
                          <component :is="c.paused ? Play : Pause" />
                        </n-icon>
                      </template>
                    </n-button>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <n-button circle quaternary size="small" :loading="actionLoadingId === c.id" title="详情" @click="openContainerDetail(c)">
                      <template #icon>
                        <n-icon size="16">
                          <Info />
                        </n-icon>
                      </template>
                    </n-button>
                    <n-button circle quaternary size="small" :loading="actionLoadingId === c.id" title="日志" @click="openLogs(c)">
                      <template #icon>
                        <n-icon size="16">
                          <Terminal />
                        </n-icon>
                      </template>
                    </n-button>
                    <n-button circle quaternary size="small" type="error" :loading="actionLoadingId === c.id" title="删除" @click="remove(c)">
                      <template #icon>
                        <n-icon size="16">
                          <Trash2 />
                        </n-icon>
                      </template>
                    </n-button>
                  </div>
                </div>
              </n-card>
            </div>
          </template>

          <template v-else>
            <div class="space-y-6">
              <n-card :bordered="false" size="small">
                <template #header>
                  <div class="flex items-center gap-2">
                    <n-icon size="18" class="text-gray-600">
                      <Layers />
                    </n-icon>
                    <span class="font-semibold">{{ '拉取镜像' }}</span>
                  </div>
                </template>
                <template #header-extra>
                  <n-button type="primary" size="small" :loading="pullLoading" :disabled="pullLoading || !pullImageText.trim()" @click="pull">
                    <template #icon>
                      <n-icon size="14">
                        <Download />
                      </n-icon>
                    </template>
                    {{ '拉取' }}
                  </n-button>
                </template>
                <n-input v-model:value="pullImageText" placeholder="例如：nginx:alpine" />
              </n-card>

              <div v-if="filteredImages.length === 0" class="py-10">
                <n-empty :description="'未找到镜像'" />
              </div>
              <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <n-card
                  v-for="img in filteredImages"
                  :key="img.id"
                  size="small"
                  :bordered="false"
                  class="hover:shadow-md transition-shadow"
                  content-style="display: flex; flex-direction: column; gap: 8px;"
                >
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-600 shrink-0">
                      <n-icon size="18">
                        <Layers />
                      </n-icon>
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                          <div class="font-semibold text-sm text-gray-900 truncate">{{ `${img.repository || ''}:${img.tag || ''}` }}</div>
                          <div class="text-xs text-gray-500 truncate font-mono">{{ img.id }}</div>
                        </div>
                        <div class="text-[11px] text-gray-400">{{ img.size }}</div>
                      </div>
                      <div class="text-[11px] text-gray-500 truncate mt-1">{{ `创建：${img.createdSince}` }}</div>
                    </div>
                  </div>
                </n-card>
              </div>
            </div>
          </template>
        </div>
          </div>
      </n-layout-content>

    <n-modal
      v-model:show="logsOpen"
      preset="card"
      :title="logsContainerName || '容器日志'"
      :bordered="false"
      :mask-closable="true"
      class="max-w-3xl"
      @update:show="(v) => { if (!v) closeLogs(); }"
    >
      <template #header-extra>
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-2">
            <div class="text-[11px] text-gray-500">{{ '行数' }}</div>
            <n-input-number
              v-model:value="logsTail"
              size="small"
              :min="1"
              :max="2000"
              :show-button="false"
              class="w-[110px]"
              @update:value="() => reloadLogs()"
            />
          </div>
          <n-button size="small" :loading="logsLoading" @click="reloadLogs">{{ '刷新' }}</n-button>
          <n-button size="small" quaternary @click="closeLogs">{{ '关闭' }}</n-button>
        </div>
      </template>
      <div class="text-xs text-gray-500 mb-3">{{ `最近 ${logsTail} 行` }}</div>
      <div class="rounded-xl bg-slate-950 text-slate-100 text-xs p-4 overflow-auto max-h-[60vh]">
        <div v-if="logsLoading" class="text-slate-400">加载中...</div>
        <pre v-else class="whitespace-pre-wrap wrap-break-word">{{ logsText || '' }}</pre>
      </div>
    </n-modal>

    <n-modal
      v-model:show="detailOpen"
      preset="card"
      :title="detailContainerName || '容器详情'"
      :bordered="false"
      :mask-closable="true"
      class="max-w-5xl"
      @update:show="(v) => { if (!v) closeContainerDetail(); }"
    >
      <template #header-extra>
        <div class="flex items-center gap-2">
          <n-button size="small" :loading="detailLoading || detailStatsLoading || detailTopLoading" @click="reloadContainerDetail">
            {{ '刷新' }}
          </n-button>
          <n-button size="small" quaternary @click="closeContainerDetail">{{ '关闭' }}</n-button>
        </div>
      </template>

      <n-tabs v-model:value="detailActiveTab" type="segment" size="small" @update:value="handleDetailTabChange">
        <n-tab-pane name="overview" tab="概览">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="md:col-span-1 space-y-4">
              <div class="rounded-[18px] bg-white/80 backdrop-blur-xl border border-black/5 p-4 shadow-sm">
                <div class="text-sm font-semibold text-gray-900">{{ detailContainerName }}</div>
                <div class="text-xs text-gray-500 mt-1 truncate">{{ detailContainer?.image || '-' }}</div>
                <div class="flex items-center gap-2 flex-wrap mt-3">
                  <n-tag size="small" :bordered="false" :type="detailContainer?.paused ? 'warning' : (detailContainer?.running ? 'success' : 'default')">
                    {{ detailContainer?.paused ? '已暂停' : (detailContainer?.running ? '运行中' : '已停止') }}
                  </n-tag>
                  <n-tag size="small" :bordered="false" type="info">
                    {{ String(detailContainer?.id || '').slice(0, 12) || '-' }}
                  </n-tag>
                </div>
              </div>

              <div class="rounded-[18px] bg-white/80 backdrop-blur-xl border border-black/5 p-4 shadow-sm">
                <div class="flex items-center gap-2">
                  <n-icon size="16" class="text-gray-600">
                    <Activity />
                  </n-icon>
                  <div class="text-sm font-semibold text-gray-900">{{ '实时状态' }}</div>
                </div>
                <div v-if="detailStatsLoading" class="text-xs text-gray-400 mt-3">加载中...</div>
                <div v-else class="text-xs text-gray-700 mt-3 space-y-2">
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-gray-500">{{ 'CPU' }}</span>
                    <span class="font-mono">{{ detailStats?.CPUPerc || '-' }}</span>
                  </div>
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-gray-500">{{ '内存' }}</span>
                    <span class="font-mono">{{ detailStats?.MemUsage || '-' }}</span>
                  </div>
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-gray-500">{{ '内存占用' }}</span>
                    <span class="font-mono">{{ detailStats?.MemPerc || '-' }}</span>
                  </div>
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-gray-500">{{ '网络' }}</span>
                    <span class="font-mono">{{ detailStats?.NetIO || '-' }}</span>
                  </div>
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-gray-500">{{ '磁盘' }}</span>
                    <span class="font-mono">{{ detailStats?.BlockIO || '-' }}</span>
                  </div>
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-gray-500">{{ 'PIDs' }}</span>
                    <span class="font-mono">{{ detailStats?.PIDs || '-' }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="md:col-span-2 space-y-4">
              <div class="rounded-[18px] bg-white/80 backdrop-blur-xl border border-black/5 p-4 shadow-sm">
                <div class="text-sm font-semibold text-gray-900">{{ '网络与存储' }}</div>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                  <div class="rounded-xl bg-gray-50 border border-gray-100 p-3">
                    <div class="text-xs font-semibold text-gray-800">{{ '端口映射' }}</div>
                    <div class="text-[11px] text-gray-600 mt-2 whitespace-pre-wrap wrap-break-word font-mono">{{ detailPortsText || '-' }}</div>
                  </div>
                  <div class="rounded-xl bg-gray-50 border border-gray-100 p-3">
                    <div class="text-xs font-semibold text-gray-800">{{ '挂载' }}</div>
                    <div class="text-[11px] text-gray-600 mt-2 whitespace-pre-wrap wrap-break-word font-mono">{{ detailVolumesText || '-' }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </n-tab-pane>

        <n-tab-pane name="config" tab="配置">
          <div class="rounded-[18px] bg-white/80 backdrop-blur-xl border border-black/5 p-4 shadow-sm">
            <div class="flex items-center justify-between gap-3">
              <div class="text-sm font-semibold text-gray-900">{{ '配置' }}</div>
              <div class="flex items-center gap-2">
                <n-button size="small" :disabled="!detailInspect" @click="fillEditorsFromInspect(false)">{{ '从当前刷新' }}</n-button>
                <n-button size="small" type="primary" :disabled="!detailInspect" @click="openRecreateFromDetail">{{ '编辑端口/挂载/环境变量' }}</n-button>
              </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
              <div>
                <div class="text-xs text-gray-600 mb-1">{{ '标签（可保存到当前容器）' }}</div>
                <n-input
                  v-model:value="detailLabelsText"
                  type="textarea"
                  :autosize="{ minRows: 5, maxRows: 10 }"
                  placeholder="key=value"
                  @update:value="markDetailLabelsDirty"
                />
                <div class="flex items-center justify-end gap-2 mt-2">
                  <n-button size="small" :disabled="!detailLabelsDirty || !detailInspect" @click="fillEditorsFromInspect(true)">{{ '撤销' }}</n-button>
                  <n-button size="small" type="primary" :loading="detailLabelsSaving" :disabled="!detailInspect" @click="saveDetailLabels">
                    {{ '保存标签' }}
                  </n-button>
                </div>
              </div>

              <div>
                <div class="text-xs text-gray-600 mb-1">{{ '环境变量（修改需重建）' }}</div>
                <n-input
                  v-model:value="detailEnvText"
                  type="textarea"
                  :autosize="{ minRows: 5, maxRows: 10 }"
                  placeholder="KEY=VALUE"
                  @update:value="markDetailEnvDirty"
                />
                <div class="flex items-center justify-end gap-2 mt-2">
                  <n-button size="small" :disabled="!detailEnvDirty || !detailInspect" @click="fillEditorsFromInspect(true)">{{ '撤销' }}</n-button>
                  <n-button size="small" type="primary" :disabled="!detailInspect" @click="openRecreateFromDetail('env')">
                    {{ '用该环境变量重建' }}
                  </n-button>
                </div>
              </div>
            </div>
          </div>
        </n-tab-pane>

        <n-tab-pane name="console" tab="控制台">
          <div class="rounded-[18px] bg-white/80 backdrop-blur-xl border border-black/5 p-4 shadow-sm">
            <div class="flex items-center gap-2">
              <n-icon size="16" class="text-gray-600">
                <Terminal />
              </n-icon>
              <div class="text-sm font-semibold text-gray-900">{{ '控制台' }}</div>
            </div>

            <div class="flex items-center gap-2 mt-3">
              <n-input v-model:value="detailExecCmd" placeholder="输入命令，例如：ls -la" @keyup.enter="execInContainer" />
              <n-button type="primary" :loading="detailExecLoading" :disabled="!detailExecCmd.trim() || !detailContainerName" @click="execInContainer">
                {{ '执行' }}
              </n-button>
            </div>

            <div class="rounded-xl bg-slate-950 text-slate-100 text-xs p-4 overflow-auto max-h-[40vh] mt-3">
              <pre class="whitespace-pre-wrap wrap-break-word">{{ detailExecOutput || '' }}</pre>
            </div>
          </div>
        </n-tab-pane>

        <n-tab-pane name="inspect" tab="Inspect">
          <div class="rounded-[18px] bg-white/80 backdrop-blur-xl border border-black/5 p-4 shadow-sm">
            <div class="text-sm font-semibold text-gray-900">{{ 'Inspect' }}</div>
            <div v-if="detailLoading" class="text-xs text-gray-400 mt-3">加载中...</div>
            <div v-else class="rounded-xl bg-slate-950 text-slate-100 text-xs p-4 overflow-auto max-h-[60vh] mt-3">
              <pre class="whitespace-pre-wrap wrap-break-word">{{ detailInspectText || '' }}</pre>
            </div>
          </div>
        </n-tab-pane>

        <n-tab-pane name="top" tab="Top">
          <div class="rounded-[18px] bg-white/80 backdrop-blur-xl border border-black/5 p-4 shadow-sm">
            <div class="text-sm font-semibold text-gray-900">{{ 'Top' }}</div>
            <div v-if="detailTopLoading" class="text-xs text-gray-400 mt-3">加载中...</div>
            <div v-else class="rounded-xl bg-slate-950 text-slate-100 text-xs p-4 overflow-auto max-h-[60vh] mt-3">
              <pre class="whitespace-pre-wrap wrap-break-word">{{ detailTopText || '' }}</pre>
            </div>
          </div>
        </n-tab-pane>
      </n-tabs>
    </n-modal>

    <n-modal
      v-model:show="runOpen"
      preset="card"
      :title="runTitle"
      :bordered="false"
      :mask-closable="true"
      class="max-w-2xl"
      @update:show="(v) => { if (!v) closeRunModal(); }"
    >
      <div class="text-xs text-gray-500 mb-3">
        {{ runMode === 'recreate' ? '将停止并删除旧容器，再以 docker run -d 重建' : '以 docker run -d 方式启动' }}
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div class="col-span-2">
          <div class="text-xs text-gray-600 mb-1">{{ '镜像（必填）' }}</div>
          <n-input v-model:value="runImage" :placeholder="'例如：nginx:alpine'" />
        </div>
        <div class="col-span-2">
          <div class="text-xs text-gray-600 mb-1">{{ '容器名（可选）' }}</div>
          <n-input v-model:value="runName" :placeholder="'例如：my_nginx'" />
        </div>
        <div class="col-span-2">
          <div class="text-xs text-gray-600 mb-1">{{ '端口映射（可选，host:container，逗号/换行分隔）' }}</div>
          <n-input v-model:value="runPortsText" type="textarea" :placeholder="'8080:80'" :autosize="{ minRows: 2, maxRows: 4 }" />
        </div>
        <div class="col-span-2">
          <div class="text-xs text-gray-600 mb-1">{{ '环境变量（可选，KEY=VALUE，一行一个）' }}</div>
          <n-input v-model:value="runEnvText" type="textarea" :placeholder="'TZ=Asia/Shanghai'" :autosize="{ minRows: 3, maxRows: 6 }" />
        </div>
        <div class="col-span-2">
          <div class="text-xs text-gray-600 mb-1">{{ '标签（可选，key=value，一行一个）' }}</div>
          <n-input v-model:value="runLabelsText" type="textarea" :placeholder="'app=myapp'" :autosize="{ minRows: 2, maxRows: 6 }" />
        </div>
        <div class="col-span-2">
          <div class="text-xs text-gray-600 mb-1">{{ '卷挂载（可选，/host:/container[:ro]，一行一个）' }}</div>
          <n-input v-model:value="runVolumesText" type="textarea" :placeholder="'/data:/data:rw'" :autosize="{ minRows: 2, maxRows: 4 }" />
        </div>
      </div>

      <template #footer>
        <div class="flex items-center justify-end gap-2">
          <n-button :disabled="runLoading" @click="closeRunModal">{{ '取消' }}</n-button>
          <n-button type="primary" :loading="runLoading" :disabled="!runImage.trim()" @click="run">
            {{ runMode === 'recreate' ? '重建' : '启动' }}
          </n-button>
        </div>
      </template>
    </n-modal>

    <n-modal
      v-model:show="jobLogsOpen"
      preset="card"
      :title="jobLogsTitle || '任务日志'"
      :bordered="false"
      :mask-closable="true"
      class="max-w-3xl"
      @update:show="(v) => { if (!v) closeJobLogs(); }"
    >
      <template #header-extra>
        <div class="flex items-center gap-2">
          <n-button size="small" :loading="jobLogsLoading" @click="reloadJobLogs">{{ '刷新' }}</n-button>
          <n-button size="small" quaternary @click="closeJobLogs">{{ '关闭' }}</n-button>
        </div>
      </template>
      <div class="text-xs text-slate-500 mb-3">{{ jobLogsMeta }}</div>
      <div class="rounded-xl bg-slate-950 text-slate-100 text-xs p-4 overflow-auto max-h-[60vh]">
        <div v-if="jobLogsLoading" class="text-slate-400">加载中...</div>
        <pre v-else class="whitespace-pre-wrap wrap-break-word">{{ jobLogsText || '' }}</pre>
      </div>
    </n-modal>
  </n-layout>
  </n-layout>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useOs } from '@/os';
import { Activity, Download, FileText, Info, Layers, MoreHorizontal, Package, Pause, Play, RefreshCw, RotateCcw, Search, Square, Store, Terminal, Trash2 } from 'lucide-vue-next';

const props = defineProps({
  files: { type: Array, default: () => [] },
  componentProps: { type: Object, default: () => ({}) }
});

const os = useOs();
const api = os.api;
const { toast } = os.ui;

const normalizeProjectKey = (input) => {
  const s = String(input ?? '').trim();
  if (!s) return 'global';
  if (s === '/') return '/';
  if (!s.startsWith('/')) return `/${s.replace(/\/+$/, '')}`;
  return s.replace(/\/+$/, '');
};

const safeProjectSuffix = (projectKey) => {
  const s = normalizeProjectKey(projectKey);
  if (s === 'global') return 'global';
  if (s === '/') return 'root';
  const base = s.split('/').filter(Boolean).pop() || 'project';
  const clean = base.replace(/[^a-zA-Z0-9_.-]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  if (clean) return clean.slice(0, 40).toLowerCase();
  return 'project';
};

const makeProjectContainerName = (baseName, projectKey) => {
  const base = String(baseName ?? '').trim();
  if (!base) return '';
  const key = normalizeProjectKey(projectKey);
  if (key === 'global') return base.slice(0, 128);
  const suffix = safeProjectSuffix(key);
  return `${base}-${suffix}`.slice(0, 128);
};

const projectKey = computed(() => {
  const fromProps = props?.componentProps?.projectKey ?? props?.componentProps?.projectPath ?? props?.componentProps?.project_path;
  if (fromProps) return normalizeProjectKey(fromProps);
  const first = Array.isArray(props?.files) ? props.files[0] : null;
  const path = first?.type === 'dir' ? first.path : first?.path;
  return normalizeProjectKey(path);
});

const activeTab = ref('apps');
const searchText = ref('');
const searchOpen = ref(false);
const loading = ref(true);
const errorMsg = ref('');
const runtimeLoaded = ref(false);
const runtimeDockerOk = ref(false);
const runtimeDockerReason = ref('');

const containers = ref([]);
const images = ref([]);

const templates = ref([]);
const templatesLoading = ref(false);
const installCreatingId = ref('');

const installJobs = ref([]);
const installJobsLoading = ref(false);
const jobCancelLoadingId = ref('');
const jobDeleteLoadingId = ref('');

const jobLogsOpen = ref(false);
const jobLogsLoading = ref(false);
const jobLogsLoadingId = ref('');
const jobLogsText = ref('');
const jobLogsId = ref('');
const jobLogsTitle = ref('');
const jobLogsMeta = ref('');

const pullImageText = ref('');
const pullLoading = ref(false);

const actionLoadingId = ref('');

const logsOpen = ref(false);
const logsLoading = ref(false);
const logsText = ref('');
const logsContainerName = ref('');
const logsTail = ref(200);

const detailOpen = ref(false);
const detailActiveTab = ref('overview');
const detailLoading = ref(false);
const detailStatsLoading = ref(false);
const detailTopLoading = ref(false);
const detailContainer = ref(null);
const detailContainerName = ref('');
const detailInspect = ref(null);
const detailStats = ref(null);
const detailTopText = ref('');
const detailLabelsText = ref('');
const detailEnvText = ref('');
const detailLabelsDirty = ref(false);
const detailEnvDirty = ref(false);
const detailLabelsSaving = ref(false);
const detailExecCmd = ref('');
const detailExecLoading = ref(false);
const detailExecOutput = ref('');
const markDetailLabelsDirty = () => { detailLabelsDirty.value = true; };
const markDetailEnvDirty = () => { detailEnvDirty.value = true; };
const detailInspectText = computed(() => {
  try {
    return detailInspect.value ? JSON.stringify(detailInspect.value, null, 2) : '';
  } catch {
    return '';
  }
});

const runOpen = ref(false);
const runLoading = ref(false);
const runMode = ref('run');
const runTargetRef = ref('');
const runTitle = computed(() => (runMode.value === 'recreate' ? '重建容器' : '运行容器'));
const runImage = ref('');
const runName = ref('');
const runPortsText = ref('');
const runEnvText = ref('');
const runLabelsText = ref('');
const runVolumesText = ref('');

const toggleSearch = () => {
  searchOpen.value = true;
};

const handleSearchBlur = () => {
  const q = String(searchText.value || '').trim();
  if (!q) searchOpen.value = false;
};

let detailStatsTimer = null;

const inspectToLabelsText = (inspect) => {
  const labels = inspect?.Config?.Labels && typeof inspect.Config.Labels === 'object' ? inspect.Config.Labels : {};
  const entries = Object.entries(labels).map(([k, v]) => [String(k || '').trim(), String(v ?? '').trim()]).filter(([k]) => !!k);
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  return entries.map(([k, v]) => `${k}=${v}`).join('\n');
};

const inspectToEnvText = (inspect) => {
  const env = Array.isArray(inspect?.Config?.Env) ? inspect.Config.Env : [];
  return env.map((v) => String(v ?? '').trim()).filter(Boolean).join('\n');
};

const inspectToPortsList = (inspect) => {
  const out = [];
  const seen = new Set();
  const pb = inspect?.HostConfig?.PortBindings && typeof inspect.HostConfig.PortBindings === 'object' ? inspect.HostConfig.PortBindings : null;
  const portsObj = pb || (inspect?.NetworkSettings?.Ports && typeof inspect.NetworkSettings.Ports === 'object' ? inspect.NetworkSettings.Ports : null);
  if (portsObj) {
    for (const [k, v] of Object.entries(portsObj)) {
      const containerPort = String(k || '').split('/')[0].trim();
      const arr = Array.isArray(v) ? v : [];
      for (const it of arr) {
        const hostPort = it?.HostPort ? String(it.HostPort).trim() : '';
        if (!hostPort || !containerPort) continue;
        const pair = `${hostPort}:${containerPort}`;
        if (seen.has(pair)) continue;
        seen.add(pair);
        out.push(pair);
      }
    }
  }
  return out;
};

const inspectToVolumesList = (inspect) => {
  const binds = Array.isArray(inspect?.HostConfig?.Binds) ? inspect.HostConfig.Binds : [];
  if (binds.length) return binds.map((v) => String(v ?? '').trim()).filter(Boolean);
  const mounts = Array.isArray(inspect?.Mounts) ? inspect.Mounts : [];
  return mounts.map((m) => {
    const src = m?.Source ? String(m.Source).trim() : '';
    const dst = m?.Destination ? String(m.Destination).trim() : '';
    if (!src || !dst) return '';
    const ro = m?.RW === false || String(m?.Mode || '').includes('ro');
    return `${src}:${dst}${ro ? ':ro' : ''}`;
  }).filter(Boolean);
};

const detailPortsText = computed(() => inspectToPortsList(detailInspect.value).join('\n'));
const detailVolumesText = computed(() => inspectToVolumesList(detailInspect.value).join('\n'));

const filteredContainers = computed(() => {
  const q = String(searchText.value || '').trim().toLowerCase();
  if (!q) return containers.value;
  return containers.value.filter((c) => {
    return (
      String(c?.name || '').toLowerCase().includes(q) ||
      String(c?.image || '').toLowerCase().includes(q) ||
      String(c?.status || '').toLowerCase().includes(q)
    );
  });
});

const filteredImages = computed(() => {
  const q = String(searchText.value || '').trim().toLowerCase();
  if (!q) return images.value;
  return images.value.filter((img) => {
    const label = `${img?.repository || ''}:${img?.tag || ''}`.toLowerCase();
    return label.includes(q) || String(img?.id || '').toLowerCase().includes(q);
  });
});

const filteredTemplates = computed(() => {
  const q = String(searchText.value || '').trim().toLowerCase();
  if (!q) return templates.value;
  return templates.value.filter((t) => {
    return (
      String(t?.name || '').toLowerCase().includes(q) ||
      String(t?.description || '').toLowerCase().includes(q) ||
      String(t?.id || '').toLowerCase().includes(q) ||
      String(t?.image || '').toLowerCase().includes(q)
    );
  });
});

const installedContainerNameByTemplateId = computed(() => {
  const map = new Map();
  const key = projectKey.value;
  const list = Array.isArray(containers.value) ? containers.value : [];
  for (const c of list) {
    const labels = c?.labels && typeof c.labels === 'object' ? c.labels : null;
    const tid = labels?.['app_store.template_id'] ? String(labels['app_store.template_id']) : '';
    const pk = labels?.['app_store.project_key'] ? String(labels['app_store.project_key']) : '';
    if (tid && pk && normalizeProjectKey(pk) === key) {
      map.set(tid, String(c?.name || ''));
    }
  }
  if (key === 'global') {
    for (const t of templates.value) {
      const tid = t?.id ? String(t.id) : '';
      if (!tid || map.has(tid)) continue;
      const expected = makeProjectContainerName(t?.defaultName || t?.id, key);
      if (!expected) continue;
      const found = list.find((c) => String(c?.name || '') === expected);
      if (found?.name) map.set(tid, String(found.name));
    }
  }
  return map;
});

const totalCount = computed(() => (Array.isArray(containers.value) ? containers.value.length : 0));
const runningCount = computed(() => (Array.isArray(containers.value) ? containers.value.filter((c) => !!c.running).length : 0));

const normalizeStatus = (s) => String(s || '').trim().toLowerCase();
const normalizeStep = (s) => String(s || '').trim().toLowerCase();

const hasActiveInstallJobs = computed(() => {
  return installJobs.value.some((j) => {
    const status = normalizeStatus(j?.status);
    return status === 'queued' || status === 'running';
  });
});

const activeInstallJobsCount = computed(() => {
  return installJobs.value.filter((j) => {
    const status = normalizeStatus(j?.status);
    return status === 'queued' || status === 'running';
  }).length;
});

const activeTitle = computed(() => {
  if (activeTab.value === 'containers') return '容器';
  if (activeTab.value === 'images') return '镜像';
  return '应用';
});

const tabItems = computed(() => {
  return [
    {
      key: 'apps',
      label: '应用',
      icon: Package,
      badge: hasActiveInstallJobs.value ? `${activeInstallJobsCount.value} 进行中` : ''
    },
    {
      key: 'containers',
      label: '容器',
      icon: Terminal,
      badge: `${runningCount.value}/${totalCount.value}`
    },
    {
      key: 'images',
      label: '镜像',
      icon: Layers,
      badge: String(filteredImages.value.length)
    }
  ];
});

const headerMenuOptions = computed(() => {
  const options = [];
  if (activeTab.value === 'containers') {
    options.push({ label: '运行容器', key: 'run', disabled: !runtimeDockerOk.value });
  }
  if (activeTab.value === 'apps') {
    options.push({ label: '刷新安装任务', key: 'refresh-jobs' });
  }
  if (activeTab.value === 'images') {
    options.push({ label: '拉取镜像', key: 'pull', disabled: pullLoading.value || !String(pullImageText.value || '').trim() });
  }
  options.push({ label: '刷新', key: 'refresh' });
  return options;
});

const handleHeaderMenuSelect = (key) => {
  const k = String(key || '');
  if (k === 'run') return openRunModal();
  if (k === 'refresh-jobs') return void refreshInstallJobs();
  if (k === 'pull') return void pull();
  if (k === 'refresh') return void loadAll();
};

const templateNameMap = computed(() => {
  const map = new Map();
  for (const t of templates.value) {
    if (t?.id) map.set(String(t.id), String(t.name || t.id));
  }
  return map;
});

let autoRefreshTimer = null;
let autoRefreshing = false;
let lastTemplatesRefreshAt = 0;
let lastRuntimeRefreshAt = 0;

const clearAutoRefresh = () => {
  if (autoRefreshTimer) clearTimeout(autoRefreshTimer);
  autoRefreshTimer = null;
};

const scheduleAutoRefresh = (delayMs = 1600) => {
  clearAutoRefresh();
  autoRefreshTimer = setTimeout(() => {
    void autoRefreshTick();
  }, Math.max(300, Number(delayMs) || 1600));
};

const refreshRuntime = async () => {
  const runtimeData = await api.dockerRuntime().catch(() => null);
  runtimeLoaded.value = true;
  runtimeDockerOk.value = !!runtimeData?.docker?.available;
  runtimeDockerReason.value = String(runtimeData?.docker?.reason || '').trim();
  return runtimeDockerOk.value;
};

const refreshContainers = async () => {
  const data = await api.dockerListContainers();
  containers.value = Array.isArray(data) ? data : [];
};

const refreshImages = async () => {
  const data = await api.dockerListImages();
  images.value = Array.isArray(data) ? data : [];
};

const autoRefreshTick = async () => {
  if (autoRefreshing) return scheduleAutoRefresh(600);
  if (loading.value) return scheduleAutoRefresh(900);
  if (logsOpen.value || runOpen.value || jobLogsOpen.value) return scheduleAutoRefresh(1200);

  autoRefreshing = true;
  try {
    const at = Date.now();
    if (at - lastRuntimeRefreshAt > 8000 || !runtimeLoaded.value) {
      lastRuntimeRefreshAt = at;
      await refreshRuntime();
    }

    if (!runtimeDockerOk.value) {
      containers.value = [];
      images.value = [];
      templates.value = [];
      installJobs.value = [];
      return scheduleAutoRefresh(2500);
    }

    if (activeTab.value === 'containers') {
      await refreshContainers();
      return scheduleAutoRefresh(2000);
    }
    if (activeTab.value === 'images') {
      await refreshImages();
      return scheduleAutoRefresh(3500);
    }

    await refreshInstallJobs(true);
    if (at - lastTemplatesRefreshAt > 60_000 || lastTemplatesRefreshAt === 0) {
      lastTemplatesRefreshAt = at;
      await loadTemplates();
    }
    return scheduleAutoRefresh(hasActiveInstallJobs.value ? 1600 : 2800);
  } catch {
    return scheduleAutoRefresh(2800);
  } finally {
    autoRefreshing = false;
  }
};

const formatTime = (ts) => {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return '-';
  try {
    return new Date(n).toLocaleString();
  } catch {
    return '-';
  }
};

const formatJobStatus = (s) => {
  const v = normalizeStatus(s);
  if (v === 'queued') return '排队中';
  if (v === 'running') return '安装中';
  if (v === 'success') return '已完成';
  if (v === 'failed') return '失败';
  if (v === 'canceled') return '已取消';
  return v || '-';
};

const formatJobStep = (s) => {
  const v = normalizeStep(s);
  if (v === 'prepare') return '准备';
  if (v === 'pull') return '拉取镜像';
  if (v === 'run') return '启动容器';
  if (v === 'done') return '完成';
  return v || '-';
};

const loadTemplates = async () => {
  templatesLoading.value = true;
  try {
    const data = await api.dockerListTemplates();
    templates.value = Array.isArray(data) ? data : [];
  } catch (err) {
    templates.value = [];
    toast?.error?.('获取模板失败');
  } finally {
    templatesLoading.value = false;
  }
};

const refreshInstallJobs = async (silent = false) => {
  if (!runtimeDockerOk.value) return;
  installJobsLoading.value = !silent;
  try {
    const data = await api.dockerListInstallJobs(30, projectKey.value);
    installJobs.value = Array.isArray(data) ? data : [];
  } catch (err) {
    if (!silent) toast?.error?.('获取任务失败');
  } finally {
    installJobsLoading.value = false;
  }
};

const installTemplate = async (tpl) => {
  if (!tpl?.id) return;
  if (!runtimeDockerOk.value) {
    toast?.error?.('失败');
    return;
  }
  installCreatingId.value = String(tpl.id);
  try {
    const job = await api.dockerCreateInstallJob(String(tpl.id), { projectKey: projectKey.value });
    toast?.success?.('已加入安装队列');
    if (job?.id) {
      await refreshInstallJobs(true);
    }
    activeTab.value = 'apps';
  } catch (err) {
    toast?.error?.(err?.message || '创建安装任务失败');
  } finally {
    installCreatingId.value = '';
  }
};

const reinstallTemplate = async (tpl) => {
  if (!tpl?.id) return;
  if (!runtimeDockerOk.value) {
    toast?.error?.('失败');
    return;
  }
  installCreatingId.value = String(tpl.id);
  try {
    const job = await api.dockerCreateInstallJob(String(tpl.id), { projectKey: projectKey.value, replaceExisting: true });
    toast?.success?.('已加入安装队列');
    if (job?.id) {
      await refreshInstallJobs(true);
    }
    activeTab.value = 'apps';
  } catch (err) {
    toast?.error?.(err?.message || '创建安装任务失败');
  } finally {
    installCreatingId.value = '';
  }
};

const cancelJob = async (job) => {
  if (!job?.id) return;
  jobCancelLoadingId.value = String(job.id);
  try {
    const next = await api.dockerCancelInstallJob(String(job.id));
    if (next?.id) {
      installJobs.value = installJobs.value.map((j) => (String(j?.id) === String(next.id) ? next : j));
    } else {
      installJobs.value = installJobs.value.map((j) =>
        String(j?.id) === String(job.id) ? { ...j, status: 'canceled', step: 'done' } : j
      );
    }
    await refreshInstallJobs(true);
    toast?.success?.('已取消');
  } catch (err) {
    toast?.error?.('取消失败');
  } finally {
    jobCancelLoadingId.value = '';
  }
};

const deleteJob = async (job) => {
  if (!job?.id) return;
  jobDeleteLoadingId.value = String(job.id);
  try {
    await api.dockerDeleteInstallJob(String(job.id));
    installJobs.value = installJobs.value.filter((j) => String(j?.id) !== String(job.id));
    if (jobLogsOpen.value && jobLogsId.value === String(job.id)) closeJobLogs();
    toast?.success?.('已删除');
  } catch (err) {
    toast?.error?.('删除失败');
  } finally {
    jobDeleteLoadingId.value = '';
  }
};

const openJobLogs = async (job) => {
  if (!job?.id) return;
  jobLogsOpen.value = true;
  jobLogsText.value = '';
  jobLogsId.value = String(job.id);
  jobLogsTitle.value = templateNameMap.value.get(job.templateId) || String(job.templateId || '安装任务');
  jobLogsMeta.value = `${formatJobStatus(job.status)} · ${formatJobStep(job.step)} · ${job.progress || 0}%`;
  await reloadJobLogs();
};

const closeJobLogs = () => {
  jobLogsOpen.value = false;
  jobLogsText.value = '';
  jobLogsId.value = '';
  jobLogsTitle.value = '';
  jobLogsMeta.value = '';
};

const reloadJobLogs = async () => {
  if (!jobLogsId.value) return;
  jobLogsLoading.value = true;
  jobLogsLoadingId.value = jobLogsId.value;
  try {
    const data = await api.dockerGetInstallJob(jobLogsId.value);
    jobLogsText.value = String(data?.logs || '');
    jobLogsTitle.value = templateNameMap.value.get(data?.templateId) || String(data?.templateId || jobLogsTitle.value);
    jobLogsMeta.value = `${formatJobStatus(data?.status)} · ${formatJobStep(data?.step)} · ${data?.progress ?? 0}%`;
  } catch (err) {
    jobLogsText.value = '';
    toast?.error?.('获取日志失败');
  } finally {
    jobLogsLoading.value = false;
    jobLogsLoadingId.value = '';
  }
};

const jumpToContainer = async (name) => {
  activeTab.value = 'containers';
  searchText.value = String(name || '').trim();
  try {
    const next = await api.dockerListContainers();
    containers.value = Array.isArray(next) ? next : containers.value;
  } catch {
    void 0;
  }
};

const loadAll = async () => {
  loading.value = true;
  errorMsg.value = '';
  clearAutoRefresh();
  try {
    await refreshRuntime();

    if (!runtimeDockerOk.value) {
      containers.value = [];
      images.value = [];
      templates.value = [];
      installJobs.value = [];
      return;
    }

    const [templatesData, containersData, imagesData, jobsData] = await Promise.all([
      api.dockerListTemplates().catch(() => []),
      api.dockerListContainers(),
      api.dockerListImages(),
      api.dockerListInstallJobs(30, projectKey.value).catch(() => [])
    ]);
    templates.value = Array.isArray(templatesData) ? templatesData : [];
    containers.value = Array.isArray(containersData) ? containersData : [];
    images.value = Array.isArray(imagesData) ? imagesData : [];
    installJobs.value = Array.isArray(jobsData) ? jobsData : [];
    lastTemplatesRefreshAt = Date.now();
    lastRuntimeRefreshAt = Date.now();
  } catch (err) {
    errorMsg.value = '加载失败';
    runtimeLoaded.value = true;
    runtimeDockerOk.value = false;
    runtimeDockerReason.value = '';
    containers.value = [];
    images.value = [];
    templates.value = [];
    installJobs.value = [];
  } finally {
    loading.value = false;
    scheduleAutoRefresh(900);
  }
};

const doContainerAction = async (c, action) => {
  if (!c?.name) return;
  if (!runtimeDockerOk.value) {
    toast?.error?.('失败');
    return;
  }
  actionLoadingId.value = c.id || c.name;
  try {
    const data = await api.dockerContainerAction(c.name, action);
    containers.value = Array.isArray(data) ? data : [];
  } catch (err) {
    toast?.error?.(err?.message ? `操作失败：${err.message}` : '操作失败');
    if (action === 'start' || action === 'restart') {
      await openLogs(c);
    }
  } finally {
    actionLoadingId.value = '';
  }
};

const toggleStartStop = async (c) => {
  if (!c) return;
  await doContainerAction(c, c.running ? 'stop' : 'start');
};

const remove = async (c) => {
  if (!c?.name) return;
  actionLoadingId.value = c.id || c.name;
  try {
    const data = await api.dockerRemoveContainer(c.name, true);
    containers.value = Array.isArray(data) ? data : [];
    toast?.success?.('已删除');
  } catch (err) {
    toast?.error?.('删除失败');
  } finally {
    actionLoadingId.value = '';
  }
};

const openLogs = async (c) => {
  logsOpen.value = true;
  logsText.value = '';
  logsContainerName.value = c?.name || '';
  await reloadLogs();
};

const closeLogs = () => {
  logsOpen.value = false;
  logsText.value = '';
  logsContainerName.value = '';
};

const reloadLogs = async () => {
  if (!logsContainerName.value) return;
  logsLoading.value = true;
  try {
    const data = await api.dockerContainerLogs(logsContainerName.value, logsTail.value);
    logsText.value = String(data?.text || '');
  } catch (err) {
    logsText.value = '';
    toast?.error?.('获取日志失败');
  } finally {
    logsLoading.value = false;
  }
};

const clearDetailStatsTimer = () => {
  if (detailStatsTimer) clearInterval(detailStatsTimer);
  detailStatsTimer = null;
};

const syncDetailContainerFromList = () => {
  const name = String(detailContainerName.value || '').trim();
  if (!name) return;
  const list = Array.isArray(containers.value) ? containers.value : [];
  const found = list.find((c) => String(c?.name || '') === name);
  if (found) detailContainer.value = found;
};

const fillEditorsFromInspect = (resetDirty = false) => {
  if (!detailInspect.value) return;
  if (resetDirty || !detailLabelsDirty.value) detailLabelsText.value = inspectToLabelsText(detailInspect.value);
  if (resetDirty || !detailEnvDirty.value) detailEnvText.value = inspectToEnvText(detailInspect.value);
  if (resetDirty) {
    detailLabelsDirty.value = false;
    detailEnvDirty.value = false;
  }
};

const saveDetailLabels = async () => {
  const name = String(detailContainerName.value || '').trim();
  if (!name || !detailInspect.value) return;
  const current = detailInspect.value?.Config?.Labels && typeof detailInspect.value.Config.Labels === 'object'
    ? detailInspect.value.Config.Labels
    : {};

  const desiredMap = new Map();
  const lines = String(detailLabelsText.value || '').split(/\r?\n/g).map((v) => v.trim()).filter(Boolean);
  for (const line of lines) {
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (!k) continue;
    desiredMap.set(k, v);
  }

  const adds = [];
  const removes = [];
  for (const [kRaw, vRaw] of Object.entries(current)) {
    const k = String(kRaw || '').trim();
    const curVal = String(vRaw ?? '').trim();
    if (!k) continue;
    if (!desiredMap.has(k)) {
      removes.push(k);
      continue;
    }
    const nextVal = String(desiredMap.get(k) ?? '').trim();
    if (nextVal && nextVal !== curVal) adds.push(`${k}=${nextVal}`);
    desiredMap.delete(k);
  }
  for (const [kRaw, vRaw] of desiredMap.entries()) {
    const k = String(kRaw || '').trim();
    const v = String(vRaw ?? '').trim();
    if (!k || !v) continue;
    adds.push(`${k}=${v}`);
  }

  detailLabelsSaving.value = true;
  try {
    const data = await api.dockerUpdateContainerLabels(name, { add: adds, remove: removes });
    containers.value = Array.isArray(data) ? data : containers.value;
    detailLabelsDirty.value = false;
    await reloadContainerInspect();
    toast?.success?.('已保存');
  } catch (err) {
    toast?.error?.(err?.message ? `保存失败：${err.message}` : '保存失败');
  } finally {
    detailLabelsSaving.value = false;
  }
};

const execInContainer = async () => {
  const name = String(detailContainerName.value || '').trim();
  const cmd = String(detailExecCmd.value || '').trim();
  if (!name || !cmd) return;
  detailExecLoading.value = true;
  try {
    const data = await api.dockerContainerExec(name, { cmd });
    const stdout = String(data?.stdout || '');
    const stderr = String(data?.stderr || '');
    const block = `$ ${cmd}\n${stdout}${stderr ? `\n${stderr}` : ''}`.trimEnd();
    const merged = String(detailExecOutput.value || '').trimEnd();
    const next = merged ? `${merged}\n\n${block}\n` : `${block}\n`;
    detailExecOutput.value = next.length > 20000 ? next.slice(-20000) : next;
  } catch (err) {
    const merged = String(detailExecOutput.value || '').trimEnd();
    const msg = err?.message ? `执行失败：${err.message}` : '执行失败';
    detailExecOutput.value = merged ? `${merged}\n\n${msg}\n` : `${msg}\n`;
  } finally {
    detailExecLoading.value = false;
  }
};

const openRecreateFromDetail = (mode = '') => {
  if (!detailInspect.value) return;
  runMode.value = 'recreate';
  runTargetRef.value = String(detailContainerName.value || '').trim();

  const inspect = detailInspect.value;
  const img = inspect?.Config?.Image ? String(inspect.Config.Image).trim() : '';
  const nm = inspect?.Name ? String(inspect.Name).replace(/^\//, '').trim() : runTargetRef.value;
  runImage.value = img;
  runName.value = nm;
  runPortsText.value = inspectToPortsList(inspect).join('\n');
  runVolumesText.value = inspectToVolumesList(inspect).join('\n');
  runLabelsText.value = String(detailLabelsText.value || '').trim() || inspectToLabelsText(inspect);
  runEnvText.value = mode === 'env' ? String(detailEnvText.value || '').trim() : inspectToEnvText(inspect);
  runOpen.value = true;
  runLoading.value = false;
};

const reloadContainerInspect = async () => {
  const name = String(detailContainerName.value || '').trim();
  if (!name) return;
  detailLoading.value = true;
  try {
    const data = await api.dockerInspectContainer(name);
    detailInspect.value = data && typeof data === 'object' ? data : null;
    fillEditorsFromInspect(false);
  } catch (err) {
    detailInspect.value = null;
    toast?.error?.('获取详情失败');
  } finally {
    detailLoading.value = false;
  }
};

const reloadContainerStats = async () => {
  const name = String(detailContainerName.value || '').trim();
  if (!name) return;
  detailStatsLoading.value = true;
  try {
    const data = await api.dockerContainerStats(name);
    detailStats.value = data && typeof data === 'object' ? data : null;
  } catch (err) {
    detailStats.value = null;
  } finally {
    detailStatsLoading.value = false;
  }
};

const reloadContainerTop = async () => {
  const name = String(detailContainerName.value || '').trim();
  if (!name) return;
  detailTopLoading.value = true;
  try {
    const data = await api.dockerContainerTop(name);
    detailTopText.value = String(data?.text || '');
  } catch (err) {
    detailTopText.value = '';
  } finally {
    detailTopLoading.value = false;
  }
};

const reloadContainerDetail = async () => {
  syncDetailContainerFromList();
  const needTop = detailActiveTab.value === 'top';
  await Promise.all([reloadContainerStats(), reloadContainerInspect(), needTop ? reloadContainerTop() : Promise.resolve()]);
};

const handleDetailTabChange = async (tab) => {
  detailActiveTab.value = String(tab || 'overview');
  if (detailActiveTab.value === 'top') await reloadContainerTop();
  if (detailActiveTab.value === 'overview') await reloadContainerStats();
  if (detailActiveTab.value === 'inspect') await reloadContainerInspect();
};

const openContainerDetail = async (c) => {
  detailOpen.value = true;
  detailActiveTab.value = 'overview';
  detailContainer.value = c || null;
  detailContainerName.value = String(c?.name || '').trim();
  detailInspect.value = null;
  detailStats.value = null;
  detailTopText.value = '';
  detailLabelsText.value = '';
  detailEnvText.value = '';
  detailLabelsDirty.value = false;
  detailEnvDirty.value = false;
  detailExecCmd.value = '';
  detailExecOutput.value = '';
  await reloadContainerDetail();
  clearDetailStatsTimer();
  detailStatsTimer = setInterval(() => {
    if (!detailOpen.value) return;
    if (detailActiveTab.value === 'overview') void reloadContainerStats();
    if (detailActiveTab.value === 'top') void reloadContainerTop();
  }, 2000);
};

const closeContainerDetail = () => {
  clearDetailStatsTimer();
  detailOpen.value = false;
  detailActiveTab.value = 'overview';
  detailContainer.value = null;
  detailContainerName.value = '';
  detailInspect.value = null;
  detailStats.value = null;
  detailTopText.value = '';
  detailLabelsText.value = '';
  detailEnvText.value = '';
  detailLabelsDirty.value = false;
  detailEnvDirty.value = false;
  detailLabelsSaving.value = false;
  detailExecCmd.value = '';
  detailExecLoading.value = false;
  detailExecOutput.value = '';
};

const pull = async () => {
  const image = String(pullImageText.value || '').trim();
  if (!image) return;
  pullLoading.value = true;
  try {
    await api.dockerPullImage(image);
    pullImageText.value = '';
    const next = await api.dockerListImages();
    images.value = Array.isArray(next) ? next : images.value;
    toast?.success?.('已拉取');
  } catch (err) {
    toast?.error?.('拉取失败');
  } finally {
    pullLoading.value = false;
  }
};

const openRunModal = () => {
  runMode.value = 'run';
  runTargetRef.value = '';
  runOpen.value = true;
  runLoading.value = false;
  runImage.value = '';
  runName.value = '';
  runPortsText.value = '';
  runEnvText.value = '';
  runLabelsText.value = '';
  runVolumesText.value = '';
};

const closeRunModal = () => {
  runOpen.value = false;
  runMode.value = 'run';
  runTargetRef.value = '';
};

const parseListText = (text) => {
  return String(text || '')
    .split(/[\n,]/g)
    .map((v) => v.trim())
    .filter(Boolean);
};

const run = async () => {
  const image = String(runImage.value || '').trim();
  if (!image) return;
  const name = String(runName.value || '').trim();
  const ports = parseListText(runPortsText.value);
  const env = String(runEnvText.value || '')
    .split(/\r?\n/g)
    .map((v) => v.trim())
    .filter((v) => !!v && v.includes('='));
  const labels = String(runLabelsText.value || '')
    .split(/\r?\n/g)
    .map((v) => v.trim())
    .filter((v) => !!v && v.includes('='));
  const volumes = parseListText(runVolumesText.value);

  runLoading.value = true;
  try {
    const payload = {
      image,
      ...(name ? { name } : {}),
      ...(ports.length ? { ports } : {}),
      ...(env.length ? { env } : {}),
      ...(labels.length ? { labels } : {}),
      ...(volumes.length ? { volumes } : {}),
    };
    if (runMode.value === 'recreate') {
      const ref = String(runTargetRef.value || '').trim();
      if (!ref) throw new Error('缺少容器引用');
      const data = await api.dockerRecreateContainer(ref, payload);
      const nextList = Array.isArray(data?.containers) ? data.containers : null;
      if (nextList) containers.value = nextList;
      closeRunModal();
      closeContainerDetail();
      toast?.success?.('已重建');
      if (!nextList) {
        const next = await api.dockerListContainers();
        containers.value = Array.isArray(next) ? next : containers.value;
      }
      return;
    }
    await api.dockerRunContainer(payload);
    toast?.success?.('已启动');
    closeRunModal();
    const next = await api.dockerListContainers();
    containers.value = Array.isArray(next) ? next : containers.value;
  } catch (err) {
    const msg = err?.message ? String(err.message) : '';
    toast?.error?.(msg ? `${runMode.value === 'recreate' ? '重建失败' : '启动失败'}：${msg}` : (runMode.value === 'recreate' ? '重建失败' : '启动失败'));
  } finally {
    runLoading.value = false;
  }
};

onMounted(async () => {
  await loadAll();
  scheduleAutoRefresh(800);
});
onBeforeUnmount(() => {
  clearAutoRefresh();
  clearDetailStatsTimer();
});
</script>

<style scoped>
:deep(.app-store-shell .n-card) {
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(18px);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(15, 23, 42, 0.06);
}

:deep(.app-store-shell .n-card .n-card-header) {
  font-weight: 600;
  color: rgb(17 24 39);
}
</style>
