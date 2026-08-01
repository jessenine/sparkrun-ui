import * as status from "./procedures/status";
import * as workloads from "./procedures/workloads";
import * as recipes from "./procedures/recipes";
import * as clusters from "./procedures/clusters";
import * as run from "./procedures/run";
import * as benchmarks from "./procedures/benchmarks";
import * as logs from "./procedures/logs";
import * as monitor from "./procedures/monitor";
import * as chat from "./procedures/chat";
import * as update from "./procedures/update";
import * as disk from "./procedures/disk";

export const router = {
  status: {
    get: status.get,
    stream: status.stream,
    jobs: status.jobs,
  },
  workloads: {
    stop: workloads.stop,
    health: workloads.health,
  },
  recipes: {
    list: recipes.list,
    listExtended: recipes.listExtended,
    listWithCategory: recipes.listWithCategory,
    readYaml: recipes.readYaml,
    show: recipes.show,
    info: recipes.info,
    validate: recipes.validate,
    dryRun: recipes.dryRun,
  },
  clusters: {
    list: clusters.list,
    getDefault: clusters.getDefault,
  },
  run: {
    start: run.start,
    startStream: run.startStream,
  },
  benchmarks: {
    list: benchmarks.list,
    get: benchmarks.get,
    profiles: benchmarks.profiles,
    run: benchmarks.run,
    watch: benchmarks.watch,
  },
  logs: {
    stream: logs.stream,
  },
  monitor: {
    stream: monitor.stream,
    processes: monitor.processes,
  },
  chat: {
    stream: chat.stream,
  },
  update: {
    stream: update.stream,
  },
  disk: {
    list: disk.list,
  },
};

export type AppRouter = typeof router;
