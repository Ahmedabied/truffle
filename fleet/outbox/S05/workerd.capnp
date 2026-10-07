using Workerd = import "/workerd/workerd.capnp";

const config :Workerd.Config = (
  services = [
    (name = "time-tests", worker = (
      compatibilityDate = "2026-10-06",
      modules = [
        (name = "main.js", esModule = embed "workerd.test.js"),
        (name = "time.js", esModule = embed "time.workerd.js")
      ]
    ))
  ]
);
