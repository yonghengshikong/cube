import Vue from "vue";
import {Component, Inject, Prop} from "vue-property-decorator";
import World from "../../../cuber/world";
import {PaletteData, PreferanceData} from "../../../data";

@Component({
    template: require("./index.html"),
})
export default class About extends Vue {
    @Inject("world")
    world: World;

    @Inject("preferance")
    preferance: PreferanceData;

    @Inject("palette")
    palette: PaletteData;

    @Prop({required: true})
    value: boolean;
    width = 0;
    height = 0;
    size = 0;
    resetd = false;

    constructor() {
        super();
    }

    get show(): boolean {
        return this.value;
    }

    set show(value) {
        this.$emit("input", value);
    }

    mounted(): void {
        this.resize();
    }

    resize(): void {
        this.width = document.documentElement.clientWidth;
        this.height = document.documentElement.clientHeight;
        this.size = Math.ceil(Math.min(this.width / 6, this.height / 12));
    }

    reset(): void {
        window.localStorage.clear();
        window.location.reload();
    }

    clear(): void {
        this.palette.reset();
        this.preferance.reset();
    }

    tap(key: string): void {
        switch (key) {
            case "help":
                window.open("https://github.com/Galaxy-Studio-Code/cube/blob/master/README.md");
                break;
            case "reset":
                this.resetd = true;
                break;
            default:
                break;
        }
        this.show = false;
    }
}
