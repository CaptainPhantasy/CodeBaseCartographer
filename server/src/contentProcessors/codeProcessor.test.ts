/**
 * Tests for code processor
 */

import { describe, it, expect } from 'vitest';
import { extractImports, processCodeFile, isCodeFile, getSupportedExtensions } from './codeProcessor.js';

describe('extractImports', () => {
  describe('Python', () => {
    it('should extract simple imports', () => {
      const code = `
import os
import sys
from collections import defaultdict
from typing import List, Dict
`;
      const imports = extractImports(code, '.py');
      expect(imports).toContain('os');
      expect(imports).toContain('sys');
      expect(imports).toContain('collections');
      expect(imports).toContain('typing');
    });

    it('should extract star imports', () => {
      const code = 'from module import *';
      const imports = extractImports(code, '.py');
      expect(imports).toContain('module');
    });
  });

  describe('Java', () => {
    it('should extract imports and package', () => {
      const code = `
package com.example.myapp;

import java.util.List;
import java.util.ArrayList;
import static java.lang.Math.PI;
`;
      const imports = extractImports(code, '.java');
      expect(imports).toContain('com.example.myapp');
      expect(imports).toContain('java.util.List');
      expect(imports).toContain('java.util.ArrayList');
      expect(imports).toContain('java.lang.Math.PI');
    });
  });

  describe('TypeScript/JavaScript', () => {
    it('should extract ES6 imports', () => {
      const code = `
import React from 'react';
import { useState, useEffect } from 'react';
`;
      const imports = extractImports(code, '.ts');
      expect(imports).toContain('react');
    });

    it('should extract CommonJS requires', () => {
      const code = `
require('fs');
require('path');
`;
      const imports = extractImports(code, '.js');
      expect(imports).toContain('fs');
      expect(imports).toContain('path');
    });

    it('should extract dynamic imports', () => {
      const code = "import('./module');";
      const imports = extractImports(code, '.ts');
      expect(imports).toContain('./module');
    });
  });

  describe('Go', () => {
    it('should extract imports', () => {
      const code = `
import "fmt"
import "os"
import . "math"
`;
      const imports = extractImports(code, '.go');
      expect(imports).toContain('fmt');
      expect(imports).toContain('os');
      expect(imports).toContain('math');
    });
  });

  describe('Rust', () => {
    it('should extract use statements', () => {
      const code = `
use std::collections::HashMap;
use std::fs::File;
mod utils;
`;
      const imports = extractImports(code, '.rs');
      expect(imports).toContain('std::collections::HashMap');
      expect(imports).toContain('std::fs::File');
      expect(imports).toContain('utils');
    });
  });

  describe('C/C++', () => {
    it('should extract includes', () => {
      const code = `
#include <stdio.h>
#include <stdlib.h>
#include "myheader.h"
`;
      const imports = extractImports(code, '.c');
      expect(imports).toContain('stdio.h');
      expect(imports).toContain('stdlib.h');
      expect(imports).toContain('myheader.h');
    });
  });

  describe('C#', () => {
    it('should extract using statements', () => {
      const code = `
using System;
using System.Collections.Generic;
using static System.Math;
`;
      const imports = extractImports(code, '.cs');
      expect(imports).toContain('System');
      expect(imports).toContain('System.Collections.Generic');
      expect(imports).toContain('System.Math');
    });
  });

  describe('Swift', () => {
    it('should extract imports', () => {
      const code = `
import Foundation
import UIKit
`;
      const imports = extractImports(code, '.swift');
      expect(imports).toContain('Foundation');
      expect(imports).toContain('UIKit');
    });
  });

  describe('Kotlin', () => {
    it('should extract imports', () => {
      const code = `
import java.util.List
import kotlin.math.max
`;
      const imports = extractImports(code, '.kt');
      expect(imports).toContain('java.util.List');
      expect(imports).toContain('kotlin.math.max');
    });
  });

  describe('PHP', () => {
    it('should extract use and require statements', () => {
      const code = `
use App\\Models\\User;
require 'vendor/autoload.php';
include 'config.php';
`;
      const imports = extractImports(code, '.php');
      expect(imports).toContain('App\\Models\\User');
      expect(imports).toContain('vendor/autoload.php');
      expect(imports).toContain('config.php');
    });
  });

  describe('Ruby', () => {
    it('should extract require statements', () => {
      const code = `
require 'json'
require_relative 'helpers'
`;
      const imports = extractImports(code, '.rb');
      expect(imports).toContain('json');
      expect(imports).toContain('helpers');
    });
  });
});

describe('processCodeFile', () => {
  it('should process Python file and extract metadata', async () => {
    const code = `
import os
import sys

def greet(name: str) -> str:
    """Greet someone."""
    return f"Hello, {name}!"

class Person:
    def __init__(self, name: str):
        self.name = name
`;
    const result = await processCodeFile(code, 'test.py');

    expect(result.summary).toContain('Python');
    expect(result.summary).toContain('lines of code');
    expect(result.metadata?.imports).toContain('os');
    expect(result.metadata?.imports).toContain('sys');
    expect(result.metadata?.complexityMetrics).toBeDefined();
    expect(result.symbols).toBeDefined();
    expect(result.symbols?.some(s => s.name === 'greet')).toBe(true);
    expect(result.symbols?.some(s => s.name === 'Person')).toBe(true);
  });

  it('should process TypeScript file and extract metadata', async () => {
    const code = `
import React from 'react';

interface Props {
  title: string;
}

export function Component({ title }: Props) {
  return <div>{title}</div>;
}

export class MyClass {
  constructor(private value: number) {}
}
`;
    const result = await processCodeFile(code, 'test.tsx');

    expect(result.summary).toContain('TypeScript');
    expect(result.metadata?.imports).toContain('react');
    expect(result.metadata?.complexityMetrics).toBeDefined();
    expect(result.symbols).toBeDefined();
    expect(result.symbols?.some(s => s.name === 'Component')).toBe(true);
    expect(result.symbols?.some(s => s.name === 'MyClass')).toBe(true);
    expect(result.symbols?.some(s => s.name === 'Props' && s.type === 'interface')).toBe(true);
  });

  it('should calculate complexity metrics correctly', async () => {
    const code = `
function complexFunction(x) {
  if (x > 0) {
    for (let i = 0; i < x; i++) {
      if (i % 2 === 0) {
        return i;
      } else if (i % 3 === 0) {
        return i * 2;
      }
    }
  }
  return x;
}
`;
    const result = await processCodeFile(code, 'test.js');
    const metrics = result.metadata?.complexityMetrics;

    expect(metrics).toBeDefined();
    expect(metrics?.cyclomaticComplexity).toBeGreaterThan(1);
    expect(metrics?.linesOfCode).toBeGreaterThan(0);
    expect(metrics?.functionCount).toBe(1);
  });

  it('should throw error for unsupported file extension', async () => {
    const code = 'some code';
    await expect(processCodeFile(code, 'test.unknown')).rejects.toThrow('Unsupported code file extension');
  });
});

describe('isCodeFile', () => {
  it('should return true for supported code files', () => {
    expect(isCodeFile('test.py')).toBe(true);
    expect(isCodeFile('test.ts')).toBe(true);
    expect(isCodeFile('test.js')).toBe(true);
    expect(isCodeFile('test.go')).toBe(true);
    expect(isCodeFile('test.rs')).toBe(true);
    expect(isCodeFile('test.java')).toBe(true);
  });

  it('should return false for non-code files', () => {
    expect(isCodeFile('test.txt')).toBe(false);
    expect(isCodeFile('test.json')).toBe(false);
    expect(isCodeFile('test.png')).toBe(false);
    expect(isCodeFile('test.unknown')).toBe(false);
  });
});

describe('getSupportedExtensions', () => {
  it('should return all supported code file extensions', () => {
    const extensions = getSupportedExtensions();

    expect(extensions).toContain('.py');
    expect(extensions).toContain('.ts');
    expect(extensions).toContain('.js');
    expect(extensions).toContain('.go');
    expect(extensions).toContain('.rs');
    expect(extensions).toContain('.java');
    expect(extensions.length).toBeGreaterThan(20);
  });
});
