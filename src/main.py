"""入口文件"""
from pathlib import Path
from src.generator import NovelGenerator


def new_novel():
    """从零开始创建新小说"""
    generator = NovelGenerator(
        title="午夜书店",
        genre="悬疑推理",
        initial_prompt="一个深夜，神秘的书店老板与一位寻找失踪书籍的顾客在一家只在午夜营业的书店相遇。",
    )

    print(f"开始生成小说《{generator.title}》...\n")

    # 大纲生成阶段会自动根据角色弧线创建角色 Agent
    generator.generate_outline()
    generator.display_outline()
    generator.save_outline()
    generator.save_agent_configs()

    print(f"角色（共 {len(generator.characters)} 人）：{', '.join(generator.characters.keys())}\n")

    # 可选：手工补充预设角色（会与大纲融合，不会重复）
    # generator.add_character(name="...", personality="...", background="...")

    generator.current_scene = "午夜十二点，窗外下着大雨，书店内灯光昏暗。门铃突然响起。"

    for i in range(5):
        print(f"\n===== 第 {i+1} 轮 =====")
        output = generator.generate_round()
        print(output)

    generator.save_as_text(overwrite=True)
    generator._logger.print_summary()

    print(f"\n{'='*60}")
    print("小说生成完成！")


def continue_novel():
    """从 output 目录还原现场，继续写作"""
    generator = NovelGenerator.from_output()

    print(f"\n✓ 已还原《{generator.title}》（角色：{', '.join(generator.characters.keys())}）")
    print("开始继续写作...\n")

    for i in range(3):
        print(f"\n===== 继续第 {i+1} 轮 =====")
        output = generator.generate_round()
        print(output)

    generator.save_outline()
    generator.save_agent_configs()

    print(f"\n{'='*60}")
    print("继续写作完成！")


def main():
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--continue":
        continue_novel()
    else:
        new_novel()


if __name__ == "__main__":
    main()
