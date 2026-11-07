interface RenderTask {
    user:     string;
    hash:     string;
    channel:  string;
    filename: string;
    config:   RenderConfig;
}

interface RenderConfig {
    fps:     "60" | "30" | "25";
    res:     "1080" | "720" | "480";
    skin:    "all" | "tag" | "me" | "none";
    name:    "all" | "hideme" | "none";
    mass:    "short" | "long" | "none";
    quality: "high" | "medium" | "low";
}

interface RenderCallbacks {
    onBegin: () => void;
    onError: (error: string) => void;
    onProgress: (progress: number) => void;
    onFinish: () => void;
}