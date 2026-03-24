"""
使用大纲生成功能的示例
展示如何先生成大纲，再根据大纲进行创作
"""

from src.generator import NovelGenerator


def example_with_outline():
    """带大纲生成的小说创作示例"""
    print("=== 创建带大纲的小说 ===\n")

    generator = NovelGenerator(
        title="迷雾侦探",
        genre="悬疑推理",
        initial_prompt="一个小城连续发生神秘失踪案，刚调来的年轻侦探发现所有失踪者都曾去过同一家废弃的精神病院。"
    )

    # 添加角色
    generator.add_character(
        name="陈峰",
        personality="冷静、观察力敏锐、不信迷信，但内心有一段不愿提及的过去",
        background="30岁的刑警队长，从大城市调来这个偏远小城，目的是调查父亲当年的失踪案"
    )

    generator.add_character(
        name="小林",
        personality="活泼、善良、有些冒失，对本地历史很了解",
        background="当地的女警，土生土长，熟悉小镇的每一个角落和传说"
    )

    generator.add_character(
        name="老院长",
        personality="阴郁、深沉、说话模糊不清，似乎隐藏着巨大的秘密",
        background="精神病院退休院长，已经80岁高龄，仍然住在疗养院附近"
    )

    generator.add_character(
        name="神秘人",
        personality="冷酷、沉默、行踪诡秘，只在夜色中活动",
        background="身份不明的黑衣人，似乎在阻止真相被揭开"
    )

    # 生成并显示大纲
    outline = generator.generate_outline()
    generator.display_outline()
    
    # 保存大纲和Agent配置
    generator.save_outline()
    generator.save_agent_configs()

    # 根据大纲生成第一部分内容
    generator.current_scene = "深夜的街道空无一人，只有警灯在闪烁。陈峰站在精神病院生锈的大门前。"

    print("\n=== 开始根据大纲创作 ===\n")
    for i in range(5):
        print(f"\n--- 第 {i+1} 轮 ---")
        print(generator.generate_round())

    # 保存生成的小说部分
    generator.save_as_text(overwrite=True)
    print("\n第一部分已生成并保存到 output/novel.txt！")


def example_romance_outline():
    """都市言情小说带大纲示例"""
    print("=== 创建言情小说大纲 ===\n")

    generator = NovelGenerator(
        title="星光下的你",
        genre="都市言情",
        initial_prompt="一个是落魄的音乐制作人，一个是当红的女明星，他们在一次意外中相遇，从此命运交织。"
    )

    # 添加角色
    generator.add_character(
        name="陆明",
        personality="才华横溢但不善表达，对音乐有执着的追求，性格有些孤僻",
        background="曾经是知名音乐制作人，因一场官司失去了一切，现在在酒吧驻唱"
    )

    generator.add_character(
        name="苏晴",
        personality="外表坚强内心柔软，渴望真挚的感情，厌倦娱乐圈的虚伪",
        background="一线女演员，外表光鲜但内心孤独，渴望寻找真实的自己"
    )

    generator.add_character(
        name="经纪人老王",
        personality="圆滑、精明、现实，但内心其实护犊子",
        background="苏晴的经纪人，在娱乐圈摸爬滚打二十年"
    )

    # 生成大纲
    outline = generator.generate_outline()
    generator.display_outline()
    
    # 保存大纲和Agent配置
    generator.save_outline()
    generator.save_agent_configs()

    # 生成开头几轮
    generator.current_scene = "深夜的酒吧里，苏晴卸下明星光环，独自坐在角落..."

    print("\n=== 开始创作 ===\n")
    for i in range(4):
        print(f"\n--- 第 {i+1} 轮 ---")
        print(generator.generate_round())

    generator.save_as_text(overwrite=True)
    print("\n小说已保存到 output/novel.txt！")


def create_custom_with_outline():
    """交互式创建带大纲的小说"""
    print("=== 自定义小说创作器（带大纲） ===\n")

    # 获取用户输入
    title = input("小说标题：") or "未命名小说"
    genre = input("小说类型：") or "都市"
    prompt = input("故事梗概：") or "一个简单的故事"

    generator = NovelGenerator(title, genre, prompt)

    # 添加角色
    print("\n添加角色（输入角色名后按回车，直接按回车结束）")
    while True:
        name = input("\n角色名：")
        if not name:
            break

        personality = input(f"{name}的性格：") or "普通"
        background = input(f"{name}的背景：") or "未知"

        generator.add_character(name, personality, background)

    if not generator.characters:
        print("至少需要一个角色！")
        return

    # 生成大纲
    outline = generator.generate_outline()
    generator.display_outline()

    # 保存大纲和Agent配置
    generator.save_outline()
    generator.save_agent_configs()

    # 询问是否继续创作
    choice = input("\n是否根据大纲开始创作？(y/n): ").strip().lower()
    if choice != 'y':
        print("大纲和配置已保存到 output/ 目录，可以稍后继续创作！")
        return

    # 设置场景
    generator.current_scene = input("\n初始场景描述：") or "故事开始..."

    try:
        rounds = int(input("生成轮数（默认5轮）：") or "5")
    except:
        rounds = 5

    # 生成小说
    print(f"\n=== 开始生成《{title}》===\n")
    for i in range(rounds):
        print(f"\n--- 第 {i+1} 轮 ---")
        print(generator.generate_round())

    generator.save_as_text(overwrite=True)
    print(f"\n《{title}》已保存到 output/novel.txt！")


if __name__ == "__main__":
    print("带大纲生成的小说创作示例\n")
    print("1. 悬疑推理小说（含大纲）")
    print("2. 都市言情小说（含大纲）")
    print("3. 自定义小说（含大纲）")

    choice = input("\n选择示例（1-3）：").strip()

    if choice == "1":
        example_with_outline()
    elif choice == "2":
        example_romance_outline()
    elif choice == "3":
        create_custom_with_outline()
    else:
        print("无效选择，运行默认示例...")
        example_with_outline()
