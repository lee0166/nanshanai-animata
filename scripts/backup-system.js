#!/usr/bin/env node
/**
 * 项目备份和回滚系统
 * 用于在优化过程中创建项目备份，确保可以安全回滚
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const BACKUP_DIR = path.join(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1'), '..', '.backup');
const EXCLUDE_PATTERNS = [
  'node_modules',
  'dist',
  'build',
  '.git',
  '.backup',
  '*.log',
  '*.tmp',
  '*.temp',
  'node_modules/*',
  'dist/*',
  'build/*',
  '.git/*',
  '.backup/*'
];

class BackupSystem {
  constructor() {
    this.backupDir = BACKUP_DIR;
    this.ensureBackupDir();
  }

  /**
   * 确保备份目录存在
   */
  ensureBackupDir() {
    console.log(`Backup directory path: ${this.backupDir}`);
    if (!fs.existsSync(this.backupDir)) {
      console.log(`Creating backup directory: ${this.backupDir}`);
      fs.mkdirSync(this.backupDir, { recursive: true });
      console.log(`Created backup directory: ${this.backupDir}`);
    } else {
      console.log(`Backup directory already exists: ${this.backupDir}`);
    }
  }

  /**
   * 创建项目备份
   * @returns {string} 备份文件路径
   */
  createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup-${timestamp}`;
    const backupPath = path.join(this.backupDir, backupName);
    
    console.log(`Creating backup: ${backupName}`);
    
    try {
      // 创建备份目录
      fs.mkdirSync(backupPath, { recursive: true });
      
      // 复制文件（排除不需要的目录）
      this.copyFiles('.', backupPath);
      
      // 创建备份信息文件
      const backupInfo = {
        timestamp: new Date().toISOString(),
        backupName,
        backupPath,
        excludePatterns: EXCLUDE_PATTERNS
      };
      
      fs.writeFileSync(
        path.join(backupPath, 'backup-info.json'),
        JSON.stringify(backupInfo, null, 2)
      );
      
      console.log(`Backup created successfully: ${backupPath}`);
      return backupPath;
    } catch (error) {
      console.error('Failed to create backup:', error);
      throw error;
    }
  }

  /**
   * 复制文件
   * @param {string} source 源目录
   * @param {string} target 目标目录
   */
  copyFiles(source, target) {
    const files = fs.readdirSync(source);
    
    files.forEach(file => {
      const sourcePath = path.join(source, file);
      const targetPath = path.join(target, file);
      
      // 检查是否应该排除
      if (this.shouldExclude(file)) {
        console.log(`Excluding: ${sourcePath}`);
        return;
      }
      
      const stat = fs.statSync(sourcePath);
      
      if (stat.isDirectory()) {
        if (!fs.existsSync(targetPath)) {
          fs.mkdirSync(targetPath);
        }
        this.copyFiles(sourcePath, targetPath);
      } else {
        fs.copyFileSync(sourcePath, targetPath);
      }
    });
  }

  /**
   * 检查是否应该排除文件
   * @param {string} file 文件名
   * @returns {boolean} 是否排除
   */
  shouldExclude(file) {
    return EXCLUDE_PATTERNS.some(pattern => {
      if (pattern.endsWith('/*')) {
        return file === pattern.replace('/*', '');
      }
      return file === pattern;
    });
  }

  /**
   * 列出所有备份
   * @returns {Array} 备份列表
   */
  listBackups() {
    if (!fs.existsSync(this.backupDir)) {
      return [];
    }
    
    const backups = fs.readdirSync(this.backupDir)
      .filter(item => {
        const itemPath = path.join(this.backupDir, item);
        return fs.statSync(itemPath).isDirectory();
      })
      .map(backupName => {
        const backupPath = path.join(this.backupDir, backupName);
        try {
          const infoPath = path.join(backupPath, 'backup-info.json');
          if (fs.existsSync(infoPath)) {
            return JSON.parse(fs.readFileSync(infoPath, 'utf8'));
          }
          return { backupName, backupPath, timestamp: 'Unknown' };
        } catch (error) {
          return { backupName, backupPath, timestamp: 'Unknown' };
        }
      })
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return backups;
  }

  /**
   * 回滚到指定备份
   * @param {string} backupName 备份名称
   */
  rollbackToBackup(backupName) {
    const backupPath = path.join(this.backupDir, backupName);
    
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup not found: ${backupName}`);
    }
    
    console.log(`Rolling back to backup: ${backupName}`);
    
    try {
      // 先创建当前状态的临时备份
      const tempBackup = this.createBackup();
      console.log(`Created temporary backup before rollback: ${tempBackup}`);
      
      // 复制备份文件到项目根目录
      this.restoreFiles(backupPath, '.');
      
      console.log(`Rollback completed successfully to: ${backupName}`);
    } catch (error) {
      console.error('Failed to rollback:', error);
      throw error;
    }
  }

  /**
   * 恢复文件
   * @param {string} source 源备份目录
   * @param {string} target 目标目录
   */
  restoreFiles(source, target) {
    const files = fs.readdirSync(source);
    
    files.forEach(file => {
      const sourcePath = path.join(source, file);
      const targetPath = path.join(target, file);
      
      // 跳过备份信息文件
      if (file === 'backup-info.json') {
        return;
      }
      
      const stat = fs.statSync(sourcePath);
      
      if (stat.isDirectory()) {
        if (!fs.existsSync(targetPath)) {
          fs.mkdirSync(targetPath, { recursive: true });
        }
        this.restoreFiles(sourcePath, targetPath);
      } else {
        // 确保目标目录存在
        const targetDir = path.dirname(targetPath);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        fs.copyFileSync(sourcePath, targetPath);
      }
    });
  }

  /**
   * 删除旧备份
   * @param {number} keepCount 保留的备份数量
   */
  cleanupOldBackups(keepCount = 5) {
    const backups = this.listBackups();
    
    if (backups.length > keepCount) {
      const backupsToDelete = backups.slice(keepCount);
      
      backupsToDelete.forEach(backup => {
        console.log(`Deleting old backup: ${backup.backupName}`);
        try {
          this.deleteDirectory(backup.backupPath);
        } catch (error) {
          console.error(`Failed to delete backup ${backup.backupName}:`, error);
        }
      });
      
      console.log(`Cleanup completed. Kept ${keepCount} most recent backups.`);
    }
  }

  /**
   * 删除目录
   * @param {string} directory 目录路径
   */
  deleteDirectory(directory) {
    if (fs.existsSync(directory)) {
      const files = fs.readdirSync(directory);
      files.forEach(file => {
        const filePath = path.join(directory, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          this.deleteDirectory(filePath);
        } else {
          fs.unlinkSync(filePath);
        }
      });
      fs.rmdirSync(directory);
    }
  }
}

// 命令行接口
if (import.meta.url === `file://${process.argv[1]}`) {
  const backupSystem = new BackupSystem();
  const command = process.argv[2];
  
  switch (command) {
    case 'create':
      backupSystem.createBackup();
      break;
    case 'list':
      const backups = backupSystem.listBackups();
      console.log('Available backups:');
      backups.forEach((backup, index) => {
        console.log(`${index + 1}. ${backup.backupName} (${backup.timestamp})`);
      });
      break;
    case 'rollback':
      const backupName = process.argv[3];
      if (backupName) {
        backupSystem.rollbackToBackup(backupName);
      } else {
        console.error('Please specify backup name to rollback to');
      }
      break;
    case 'cleanup':
      const keepCount = process.argv[3] ? parseInt(process.argv[3]) : 5;
      backupSystem.cleanupOldBackups(keepCount);
      break;
    default:
      console.log('Usage:');
      console.log('  node backup-system.js create - Create a new backup');
      console.log('  node backup-system.js list - List all backups');
      console.log('  node backup-system.js rollback <backup-name> - Rollback to specified backup');
      console.log('  node backup-system.js cleanup [keep-count] - Cleanup old backups');
  }
}

export default BackupSystem;