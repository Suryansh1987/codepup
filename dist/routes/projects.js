"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const projectService_1 = __importDefault(require("../services/projectService"));
const messageService_1 = __importDefault(require("../services/messageService"));
const router = (0, express_1.Router)();
// Create project
router.post("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const project = yield projectService_1.default.createProject(req.body);
        res.json(project);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
// Get projects by user ID
router.get("/user/:userId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projects = yield projectService_1.default.getProjectsByUserId(parseInt(req.params.userId));
        res.json(projects);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
// Get project by ID
router.get("/:projectId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const project = yield projectService_1.default.getProjectById(parseInt(req.params.projectId));
        // if (!project) {
        //   return res.json();
        // }
        res.json(project);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
// Update project
router.put("/:projectId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const project = yield projectService_1.default.updateProject(parseInt(req.params.projectId), req.body);
        res.json(project);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
// Delete project
router.delete("/:projectId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield projectService_1.default.deleteProject(parseInt(req.params.projectId));
        res.json({ message: "Project deleted successfully" });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
// Get messages for a project
router.get("/:projectId/messages", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const messages = yield messageService_1.default.getMessagesByProjectId(parseInt(req.params.projectId));
        res.json(messages);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
exports.default = router;
//# sourceMappingURL=projects.js.map